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
 *  The Command class is a parent class inherited by all the ConcreteCommand subclasses
 */
class Command {
  constructor(args){
    this.args = new CommandArgs(args);
    this.immediateReturnMessage = commandPendingMessage();
  }
  
  parse(){}
  getSheetData(){}
  updateSheet(){}
  formulateUserResponse(){}
  sendSlackPayloads(){}
  nextCommand(){
    // Default behaviour is that no further command is executed. 
    // However, some {command,arg} combinations lead to chained commands 
    // example: {DoneCommand,this.requestNextStatus='keepOpenNew'}' triggers CancelCommand.
  }
  
  execute(){
    this.tracking_sheet = new TrackingSheetWrapper();
    this.log_sheet = new LogSheetWrapper(); //do not instantiate these in constructor because they take ~300ms and would compromise immediate response
    this.getSheetData();
    var message = this.formulateUserResponse();
    this.updateSheet();
    this.sendSlackPayloads();
    this.nextCommand();
    return message;
  }
  
  execute_superUser(){
    this.tracking_sheet = new TrackingSheetWrapper();
    this.log_sheet = new LogSheetWrapper();
    this.getSheetData();
    this.updateSheet();
    this.sendSlackPayloads();
    this.nextCommand();
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
  
  formulateUserResponse(){
    return assignPendingMessage();
  }
  
  nextCommand(){  
    this.args.userid = this.args.mention.userid;
    this.args.username = this.args.mention.username;
    processFunctionAsync('/volunteer', this.args); // todo: clean up string call
  }
}


/**
 *  Manage a volunteering command from user
 */
class VolunteerCommand extends Command {
  
  parse(){
    this.args.parseUniqueID();
  }
  
  getSheetData(){
    this.row = this.tracking_sheet.getRowByUniqueID(this.args.uniqueid);
  }
  
  updateSheet(){
    this.row.slackVolunteerID = this.args.userid;
    this.row.slackVolunteerName = this.args.username;
    this.row.requestStatus = "Assigned";
    this.tracking_sheet.writeRow(this.row);
    this.log_sheet.appendRow([new Date(), this.args.uniqueid, this.args.userid,'slackCommand','volunteer']);
  }
  
  formulateUserResponse(){
    checkUniqueIDexists(this.row, this.args);
    checkUniqueIDconsistency(this.row, this.args);
    checkChannelIDconsistency(this.row, this.args);
    checkRowIsVolunteerable(this.row, this.args);
    return volunteerSuccessMessage(this.row,true);
  }
  
  sendSlackPayloads(){
    var out_message = volunteerChannelMessage(this.row);
    var payload = JSON.stringify({
      text: out_message,
      thread_ts: this.row.slackTS,
      channel: this.row.channelid,
    });
    slackChannelReply(payload,this.row.uniqueid);
  }
}


/**
 *  Manage a cancel command from user or moderator
 */
class CancelCommand extends Command {
  
  parse(){
    this.args.parseUniqueID();
  }
  
  getSheetData(){
    this.row = this.tracking_sheet.getRowByUniqueID(this.args.uniqueid);
  }
  
  updateSheet(){
    this.slackVolunteerID_old = this.row.slackVolunteerID; // store this for channel response
    this.row.slackVolunteerID = '';
    this.row.slackVolunteerName = '';
    this.row.requestStatus = 'Sent';
    this.tracking_sheet.writeRow(this.row);
    this.log_sheet.appendRow([new Date(), this.args.uniqueid, this.args.userid,'slackCommand','cancel']);
  }
  
  formulateUserResponse(){
    checkUniqueIDexists(this.row, this.args);
    checkUniqueIDconsistency(this.row, this.args);
    checkChannelIDconsistency(this.row, this.args);
    checkRowIsCancellable(this.row, this.args);
    return cancelSuccessMessage(this.row,true);
  }
  
  sendSlackPayloads(){
    var out_message = cancelChannelMessage(this.row,this.slackVolunteerID_old)                                                                                                            
    var payload = JSON.stringify({
    text: out_message,
      thread_ts: this.row.slackTS,
      reply_broadcast: true,
      channel: this.row.channelid});
    slackChannelReply(payload,this.row.uniqueid);
  }
}

/**
 *  Manage a done modal request from user or moderator
 */
class DoneSendModalCommand extends Command {
  
  parse(){
    this.args.parseUniqueID();
  }
  
  formulateUserResponse(){
    return doneSendModalSuccessMessage(this.args);
  }
  
  sendSlackPayloads(){ // Send post request to Slack views.open API to open a modal for user
    var cmd_metadata = JSON.stringify({
      uniqueid: this.args.uniqueid,
      channelid: this.args.channelid,
      response_url: this.args.response_url
    }); // data passed as metadata in modal, to follow up on command request once modal user submission is received
    var out_message = doneModalMessage(this.args.uniqueid, this.args.userid, cmd_metadata);
    var payload = JSON.stringify({
      trigger_id: this.args.trigger_id,
      view: out_message});
    slackModalReply(payload, this.args.uniqueid);
  }
}


/**
 *  Manage a done command from user or moderator
 */
class DoneCommand extends Command {
  constructor(args){
    super(args);
    
    this.immediateReturnMessage = null; // modal requires a blank HTTP 200 OK immediate response to close
    
    // done modal responses
    var modalResponseVals = args.more;
    this.requestNextStatus = modalResponseVals.requestNextStatus.requestNextStatusVal.selected_option.value;
    this.completionLastDetails = modalResponseVals.completionLastDetails.completionLastDetailsVal.value;
    if (!this.completionLastDetails){
      this.completionLastDetails=''; // replace undefined with ''
    }
  }
  
  parse(){
    this.args.parseUniqueID();
  }
  
  getSheetData(){
    this.row = this.tracking_sheet.getRowByUniqueID(this.args.uniqueid);
  }
  
  updateSheet(){
    if ((this.requestNextStatus === '') || (this.requestNextStatus === 'unsure') || (this.requestNextStatus === 'toClose')){
      this.row.requestStatus = 'ToClose?';
    } else if (this.requestNextStatus === 'keepOpenAssigned'){
      this.row.requestStatus = "Assigned";
    }
    this.row.completionCount = +this.row.completionCount +1;
    this.row.completionLastDetails = this.completionLastDetails;
    this.row.completionLastTimestamp = new Date();
    this.tracking_sheet.writeRow(this.row);
    this.log_sheet.appendRow([new Date(), this.args.uniqueid, this.args.userid,'slackCommand','done', this.completionLastDetails]);
  }
  
  formulateUserResponse(){
    checkUniqueIDexists(this.row, this.args);
    checkUniqueIDconsistency(this.row, this.args);
    checkChannelIDconsistency(this.row, this.args);
    checkRowAcceptsDone(this.row, this.args);
    return doneSuccessMessage(this.row,true);
  }
  
  sendSlackPayloads(){
    var out_message = doneChannelMessage(this.row);
    var payload = JSON.stringify({
      text: out_message,
      thread_ts: this.row.slackTS,
      channel: this.row.channelid});
    slackChannelReply(payload,this.row.uniqueid);
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
  
  formulateUserResponse(){
    var message_out = listHeaderMessage('list');

    var classScope = this;
    this.rows.forEach(function(row) { // append...
      if (isVarInArray(row.requestStatus,['','Sent']) && 
          row.channelid == classScope.args.channelid) { // ... if empty status and correct channel
        message_out += listLineMessage(row);
      }
    });
    
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
  
  formulateUserResponse(){
    var message_out = listHeaderMessage('listactive');

    var classScope = this;
    this.rows.forEach(function(row) {
      if (isVarInArray(row.requestStatus,['','Sent','Assigned','Ongoing']) && 
          row.channelid == classScope.args.channelid) { // non-closed status and correct channel
        message_out += listLineMessage(row,true,true);
      }
    });
    
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
  
  formulateUserResponse(){
    var message_out = listHeaderMessage('listall');

    var classScope = this;
    this.rows.forEach(function(row) {
      if (row.channelid == classScope.args.channelid) { // correct channel
        message_out += listLineMessage(row,true,true);
      }
    });
    
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
  
  formulateUserResponse(){
    var message_out = listHeaderMessage('listmine');

    var classScope = this;
    this.rows.forEach(function(row) {
      if (isVarInArray(row.requestStatus,['Assigned','Ongoing']) && 
          row.slackVolunteerID == classScope.args.userid && 
          row.channelid == classScope.args.channelid) { // non-closed status, belongs to user and correct channel
        message_out += listLineMessage(row,false,false);
      }
    });
    
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
  
  formulateUserResponse(){
    var message_out = listHeaderMessage('listallmine');

    var classScope = this;
    this.rows.forEach(function(row) {
      if (row.slackVolunteerID == classScope.args.userid && 
          row.channelid == classScope.args.channelid) { //  belongs to user and correct channel
        message_out += listLineMessage(row,true,false);
      }
    });
    
    return textToJsonBlocks(message_out);
  }
}