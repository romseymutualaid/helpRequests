// A set of command models are defined here (Command subclasses).
//
// All models interface with the database (google sheets) and the view (slack API).
// Models have a common Command.execute() method which:
// - gets relevant data from the database
// - validates command according to database state (throws error if command is not allowed)
// - updates view and database as required
//
// See database functions in sheet_wrapper.gs.
// See command validity functions in rowChecks.gs.
// See view functions in slack_messaging.gs.


/*** CONSTRUCTORS ***/

/**
 *  Return the appropriate Command subclass instance based on the specified slackCmdString and args parameters.
 * @param {*} slackCmdString
 * @param {*} args
 */
var createCommandClassInstance = function(slackCmdString, args){
  
  var SUBCLASS_FROM_SLACKCMD = globalVariables().SUBCLASS_FROM_SLACKCMD;
  
  if (!SUBCLASS_FROM_SLACKCMD.hasOwnProperty(slackCmdString)){ // if no key is found for slackCmdString, return error
    throw new Error(commandNotSupportedMessage(slackCmdString));
  }
  if (typeof SUBCLASS_FROM_SLACKCMD[slackCmdString] !== 'function'){
    throw new Error(commandNotConnectedMessage(slackCmdString));
  }
  if (typeof args !== 'object' || args === null){
    throw new Error(commandArgumentsAreCorruptedMessage());
  }
  
  return new SUBCLASS_FROM_SLACKCMD[slackCmdString](args);
}


/*** LOGIC ***/

/**
 *  The CommandArgs class encapsulates and formats the arguments passed to a ConcreteCommand,
 *  as well as methods to manipulate those args (parsing, etc.).
 */
class CommandArgs {
  constructor(args){
    this.uniqueid = args.uniqueid;
    this.channelid = args.channelid;
    this.userid = args.userid;
    this.username = args.username;
    this.mention = args.mention; // object with expected property "str"
    this.more = args.more;
    
    this.response_url = args.response_url;
    this.trigger_id = args.trigger_id;
    
    this.mod_userid = globalVariables()['MOD_USERID'];
    this.mention_mod = globalVariables()['MENTION_REQUESTCOORD'];
  }
  
  parseUniqueID(){
    var regexpToMatch = "^[0-9]{4}$";
    var msg_empty_str = uniqueIDnotProvidedMessage();
    var msg_nomatch_str = uniqueIDsyntaxIsIncorrectMessage(this);
    extractMatchOrThrowError(this.uniqueid, regexpToMatch, msg_empty_str, msg_nomatch_str);
  }
  
  parseMentionString(){
    var regexpToMatch = "<@(U[A-Z0-9]+)\\|?(.*)>";
    var msg_empty_str = userMentionNotProvidedMessage();
    var msg_nomatch_str = userMentionSyntaxIsIncorrectMessage(this);
    var re_match = extractMatchOrThrowError(this.mention.str, regexpToMatch, msg_empty_str, msg_nomatch_str);
    this.mention.userid = re_match[1];
    this.mention.username = re_match[2];
  }
  
  matchUserID(str_to_match){
    return (this.userid === str_to_match);
  }
}


/**
 *  The Command class is an abstract class inherited by all the ConcreteCommand subclasses
 */
class Command {
  constructor(args){
    this.args = new CommandArgs(args);
    this.immediateReturnMessage = commandPendingMessage();
    this.loggerMessage={
      uniqueid:this.args.uniqueid,
      userid:this.args.userid,
      type:'command',
      subtype:'',
      additionalInfo:''
    };
  }
  
  parse(){}
  
  getSheetData(){}
  checkCommandValidity(){}
  updateState(){}
  notify(){}
  nextCommand(){
    // Default behaviour is that no further command is executed. 
    // However, some {command,arg} combinations lead to chained commands 
    // example: {DoneCommand,this.requestNextStatus='keepOpenNew'}' triggers CancelCommand.
  }
  
  execute(){
    this.tracking_sheet = new TrackingSheetWrapper();
    this.log_sheet = new LogSheetWrapper(); //do not instantiate these in constructor because they take ~300ms and would compromise immediate response
    this.getSheetData();
    this.checkCommandValidity();
    this.updateState();
    var returnMessage = this.notify();
    this.nextCommand();
    return returnMessage;
  }
}


/**
 *  Handler for a "do nothing" command
 */
class VoidCommand extends Command {
}

class HomeShortcutCommand extends Command {
  notify(){
    // Send post request to Slack views.open API to open a modal for user
    var payload = appHomeShortcutModalMessage(this.args);
    var modalMessenger = new SlackModalMessenger(this);
    var return_message = modalMessenger.send(payload);
  
    // halt if message was not successfully sent
    if (JSON.parse(return_message).ok !== true){
      throw new Error(postToSlackDefaultModalErrorMessage(return_message));
    }
    
    // user return message printer
    return defaultSendModalSuccessMessage();
  }
}

/**
 *  Manage an opening of the slack app home page by user
 */
class HomeOpenedCommand extends Command {
  parse(){
    if(this.args.more.tab !== 'home'){
      throw new Error(AppHomeWrongTabErrorMessage());
    }
  }
  
  getSheetData(){
    this.rows = this.tracking_sheet.getAllRows()
    .filter(
      // non-closed status, belongs to user
      row => isVarInArray(row.requestStatus,['Assigned','Ongoing']) &&
      row.slackVolunteerID === this.args.userid
      );
  }
  
  notify(){
    
    // slack app home messenger
    var payload = appHomeMessage(this.args, this.rows);
    var appHomeMessenger = new SlackAppHomeMessenger(this);
    var return_message = appHomeMessenger.send(payload);    
  }
}


/**
 *  Manage a StatusLog command from super user
 */
class StatusLogCommand extends Command {
  constructor(args){
    super(args);
    this.loggerMessage.subtype='statusManualEdit';
    this.loggerMessage.additionalInfo=this.args.more.requestStatusValue;
  }
  
  notify(){
    this.log_sheet.appendFormattedRow(this.loggerMessage);
  }
}


/**
 *  Manage a PostRequest command from super user
 */
class PostRequestCommand extends Command {
  constructor(args){
    super(args);
    this.loggerMessage.subtype='postRequest';
  }
  
  getSheetData(){
    this.row = this.tracking_sheet.getRowByUniqueID(this.args.uniqueid);
  }
  
  notify(){
    
    // slack channel messenger
    var payload = postRequestMessage(this.row);
    var channelMessenger = new SlackChannelMessenger(this);
    var return_message = channelMessenger.send(payload);
  
    // tracking sheet writer
    var return_params = JSON.parse(return_message);
    this.row.slackVolunteerID = '';
    this.row.slackVolunteerName = '';
    if (return_params.ok === true){ // message was succesfully posted to channel
      this.row.slackTS = return_params.ts;
      this.row.requestStatus = 'Sent';
      
      this.loggerMessage.additionalInfo = JSON.stringify({
        channelid:this.row.channelid,
        slackThreadID:this.row.slackTS
      });
      this.log_sheet.appendFormattedRow(this.loggerMessage);
    } else{
      this.row.slackTS = '';
      this.row.requestStatus = 'FailSend';
    }
    this.tracking_sheet.writeRow(this.row);
  }
  
}


/**
 *  Manage an assignment command from moderator
 */
class AssignCommand extends Command {
  
  parse(){
    // check userid is a moderator
    var mod_userid = globalVariables()['MOD_USERID'];
    if(!this.args.matchUserID(mod_userid)){
      throw new Error(commandAvailableOnlyToModeratorMessage("assign"));
    }
    
    this.args.parseUniqueID();
    this.args.parseMentionString();
  }
  
  updateState(){
    this.args.userid = this.args.mention.userid;
    this.args.username = this.args.mention.username;
  }
  
  notify(){
    return assignPendingMessage();
  }
  
  nextCommand(){  
    processFunctionAsync('/volunteer', this.args); // todo: clean up string call
  }
}


/**
 *  Manage a volunteering command from user
 */
class VolunteerCommand extends Command {
  constructor(args){
    super(args);
    this.loggerMessage.subtype='volunteer';
  }
  
  parse(){
    this.args.parseUniqueID();
  }
  
  getSheetData(){
    this.row = this.tracking_sheet.getRowByUniqueID(this.args.uniqueid);
  }
  
  checkCommandValidity(){
    checkUniqueIDexists(this.row, this.args);
    checkUniqueIDconsistency(this.row, this.args);
    checkChannelIDconsistency(this.row, this.args);
    checkRowIsVolunteerable(this.row, this.args);
  }
  
  updateState(){
    this.row.slackVolunteerID = this.args.userid;
    this.row.slackVolunteerName = this.args.username;
    this.row.requestStatus = "Assigned";
  }
  
  notify(){
    
    // slack channel chat.update messenger
    // updates postRequest message to no longer have the "volunteer" button
    var payload = postRequestMessage(this.row,false);
    var channelMessenger = new SlackChannelUpdateMessenger(this);
    var return_message = channelMessenger.send(payload);
    
    // halt if message was not successfully sent
    if (JSON.parse(return_message).ok !== true){
      throw new Error(postToSlackChannelErrorMessage());
    }
    
    // slack channel messenger
    var payload = volunteerChannelMessage(this.row);
    var channelMessenger = new SlackChannelMessenger(this);
    var return_message = channelMessenger.send(payload);
    
    // halt if message was not successfully sent
    if (JSON.parse(return_message).ok !== true){
      throw new Error(postToSlackChannelErrorMessage());
    }
    
    // tracking sheet writer
    this.tracking_sheet.writeRow(this.row);
    this.log_sheet.appendFormattedRow(this.loggerMessage);
    
    // user return message printer
    return volunteerSuccessMessage(this.row);
  }
}


/**
 *  Manage a cancel command from user or moderator
 */
class CancelCommand extends Command {
  constructor(args){
    super(args);
    this.loggerMessage.subtype='cancel';
  }
  
  parse(){
    this.args.parseUniqueID();
  }
  
  getSheetData(){
    this.row = this.tracking_sheet.getRowByUniqueID(this.args.uniqueid);
  }
  
  checkCommandValidity(){
    checkUniqueIDexists(this.row, this.args);
    checkUniqueIDconsistency(this.row, this.args);
    checkRowIsCancellable(this.row, this.args);
  }
  
  updateState(){
    this.slackVolunteerID_old = this.row.slackVolunteerID; // store this for channel messenger in notify()
    this.row.slackVolunteerID = '';
    this.row.slackVolunteerName = '';
    this.row.requestStatus = 'Sent';
  }
  
  notify(){
    
    // slack channel chat.update messenger
    // updates postRequest message to regain the "volunteer" button
    var payload = postRequestMessage(this.row,true);
    var channelMessenger = new SlackChannelUpdateMessenger(this);
    var return_message = channelMessenger.send(payload);
    
    // halt if message was not successfully sent
    if (JSON.parse(return_message).ok !== true){
      throw new Error(postToSlackChannelErrorMessage());
    }
    
    // slack channel messenger
    var payload = cancelChannelMessage(this.row,this.slackVolunteerID_old);                                                                                                           
    var channelMessenger = new SlackChannelMessenger(this);
    var return_message = channelMessenger.send(payload);
    
    // halt if message was not successfully sent
    if (JSON.parse(return_message).ok !== true){
      throw new Error(postToSlackChannelErrorMessage());
    }
    
    // tracking sheet writer
    this.tracking_sheet.writeRow(this.row);
    this.log_sheet.appendFormattedRow(this.loggerMessage);
    
    // user return message printer
    return cancelSuccessMessage(this.row,true);
  }
}

/**
 *  Manage a done modal request from user or moderator
 */
class DoneSendModalCommand extends Command {
  
  parse(){
    this.args.parseUniqueID();
  }
  
  notify(){
    
    // Send post request to Slack views.open API to open a modal for user
    var payload = doneModalMessage(this.args);
    var modalMessenger = new SlackModalMessenger(this);
    var return_message = modalMessenger.send(payload);
  
    // halt if message was not successfully sent
    if (JSON.parse(return_message).ok !== true){
      throw new Error(postToSlackDoneModalErrorMessage(return_message));
    }
    
    // user return message printer
    return doneSendModalSuccessMessage(this.args);
  }
}


/**
 *  Manage a done command from user or moderator
 */
class DoneCommand extends Command {
  constructor(args){
    super(args);
    
    this.immediateReturnMessage = null; // modal requires a blank HTTP 200 OK immediate response to close
    this.loggerMessage.subtype='done';

    // done modal responses
    var modalResponseVals = args.more.modalResponseValues;
    this.requestNextStatus = modalResponseVals.requestNextStatus.requestNextStatusVal.selected_option.value;
    // check optional argument isn't empty or undefined
    if (
      modalResponseVals.completionLastDetails && 
      modalResponseVals.requestNextStatus.requestNextStatusVal &&
      modalResponseVals.requestNextStatus.requestNextStatusVal.selected_option &&
      modalResponseVals.requestNextStatus.requestNextStatusVal.selected_option.value
    ){
      this.completionLastDetails = modalResponseVals.completionLastDetails.completionLastDetailsVal.value;
    } else{
      this.completionLastDetails = ''; // replace null/undefined with ''
    }
  }
  
  parse(){
    this.args.parseUniqueID();
  }
  
  getSheetData(){
    this.row = this.tracking_sheet.getRowByUniqueID(this.args.uniqueid);
  }
  
  updateState(){
    if ((this.requestNextStatus === '') || (this.requestNextStatus === 'unsure') || (this.requestNextStatus === 'toClose')){
      this.row.requestStatus = 'ToClose?';
    } else if (this.requestNextStatus === 'keepOpenAssigned'){
      this.row.requestStatus = "Assigned";
    }
    this.row.completionCount = +this.row.completionCount +1;
    this.row.completionLastDetails = this.completionLastDetails;
    this.row.completionLastTimestamp = new Date();
  }
  
  checkCommandValidity(){
    checkUniqueIDexists(this.row, this.args);
    checkUniqueIDconsistency(this.row, this.args);
    checkRowAcceptsDone(this.row, this.args);
  }
  
  notify(){
    
    // slack channel messenger
    var payload = doneChannelMessage(this.row);
    var channelMessenger = new SlackChannelMessenger(this);
    var return_message = channelMessenger.send(payload);
    
    // halt if message was not successfully sent
    if (JSON.parse(return_message).ok !== true){ // message was not successfully sent
      throw new Error(postToSlackChannelErrorMessage());
    }
    
    // tracking sheet writer
    this.loggerMessage.additionalInfo = this.row.completionLastDetails;
    this.tracking_sheet.writeRow(this.row);
    this.log_sheet.appendFormattedRow(this.loggerMessage);
    
    // user return message printer
    return doneSuccessMessage(this.row,true);
  }
  
  nextCommand(){
    if (this.requestNextStatus === 'keepOpenNew'){
      processFunctionAsync('/cancel', this.args); //todo:clean up string call
    }
  }
}


/**
 *  Manage a list command from user or moderator
 */
class ListCommand extends Command {
  
  getSheetData(){
    this.rows = this.tracking_sheet.getAllRows();
  }
  
  notify(){
    // user return message printer
    var message_out_header = listHeaderMessage('list');
    
    var message_out_body = this.rows
    .filter(
      row => isVarInArray(row.requestStatus,['','Sent']) &&
      row.channelid === this.args.channelid
      )
      .map(row => listLineMessage(row))
      .join('');

    var message_out = message_out_header + message_out_body;
    
    return textToJsonBlocks(message_out);
  }
}


/**
 *  Manage a listactive command from user or moderator
 */
class ListActiveCommand extends Command {
  
  getSheetData(){
    this.rows = this.tracking_sheet.getAllRows();
  }
  
  notify(){
    // user return message printer
    var message_out_header = listHeaderMessage('listactive');
    
    var message_out_body = this.rows
    .filter(
      // non-closed status and correct channel
      row => isVarInArray(row.requestStatus,['','Sent','Assigned','Ongoing']) &&
      row.channelid === this.args.channelid
      )
      .map(row => listLineMessage(row,true,true))
      .join('');

    var message_out = message_out_header + message_out_body;
    
    return textToJsonBlocks(message_out);
  }
}


/**
 *  Manage a listall command from user or moderator
 */
class ListAllCommand extends Command {
  
  getSheetData(){
    this.rows = this.tracking_sheet.getAllRows();
  }
  
  notify(){
    // user return message printer    
    var message_out_header = listHeaderMessage('listall');
    
    var message_out_body = this.rows
    .filter(
      // correct channel
      row => row.channelid === this.args.channelid
      )
      .map(row => listLineMessage(row,true,true))
      .join('');

    var message_out = message_out_header + message_out_body;
    
    return textToJsonBlocks(message_out);
  }
}


/**
 *  Manage a listmine command from user or moderator
 */
class ListMineCommand extends Command {
  
  getSheetData(){
    this.rows = this.tracking_sheet.getAllRows();
  }
  
  notify(){
    // user return message printer
    var message_out_header = listHeaderMessage('listmine');
    
    var message_out_body = this.rows
    .filter(
      // non-closed status, belongs to user and correct channel
      row => isVarInArray(row.requestStatus,['Assigned','Ongoing']) &&
      row.slackVolunteerID === this.args.userid
      )
      .map(row => listLineMessage(row,false,false))
      .join('');

    var message_out = message_out_header + message_out_body;

    return textToJsonBlocks(message_out);
  }
}


/**
 *  Manage a listallmine command from user or moderator
 */
class ListAllMineCommand extends Command {
  
  getSheetData(){
    this.rows = this.tracking_sheet.getAllRows();
  }
  
  notify(){ 
    // user return message printer
    var message_out_header = listHeaderMessage('listallmine');
    
    var message_out_body = this.rows
    .filter(
      //  belongs to user and correct channel
      row => row.slackVolunteerID === this.args.userid
      )
      .map(row => listLineMessage(row,true,false))
      .join('');

    var message_out = message_out_header + message_out_body;
    
    return textToJsonBlocks(message_out);
  }
}