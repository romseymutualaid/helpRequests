/**
 *  Return the appropriate Command subclass instance based on the specified slackCmdString and args parameters.
 * @param {*} slackCmdString
 * @param {*} args
 */
var createCommandClassInstance = function(slackCmdString, args){
  
  var SUBCLASS_FROM_SLACKCMD = globalVariables().SUBCLASS_FROM_SLACKCMD;
  
  if (!SUBCLASS_FROM_SLACKCMD.hasOwnProperty(slackCmdString)){ // if no key is found for slackCmdString, return error
    throw new Error(`error: The \`${slackCmdString}\` command is not currently supported.`);
  }
  if (typeof SUBCLASS_FROM_SLACKCMD[slackCmdString] !== 'function'){
    throw new Error(`error: The \`${slackCmdString}\` command is not properly connected on the server.
                    Can you please notify a developer?`);
  }
  if (typeof args !== 'object' || args === null){
    throw new Error(`error: I couldn't process the arguments provided. Can you please notify a developer?`);
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
    var msg_empty_str = `error: You must provide the request number present in the help request message (example: \`/volunteer 9999\`).
    You appear to have not typed any number. If the issue persists, contact ${this.mention_mod}.`;
    var msg_nomatch_str = `error: The request number \`${this.uniqueid}\` does not appear to be a 4-digit number as expected.
    Please specify a correct request number (example: \`/volunteer 9999\`). If the issue persists, contact ${this.mention_mod}.`;
    
    extractMatchOrThrowError(this.uniqueid, regexpToMatch, msg_empty_str, msg_nomatch_str);
  }
  
  parseMentionString(){
    var regexpToMatch = "<@(U[A-Z0-9]+)\\|?(.*)>";
    var msg_empty_str = `error: You must mention a user that the command applies to (example: \`/assign 9999 ${this.mention_mod}\`).
    You appear to have not mentioned anyone. If the issue persists, contact ${this.mention_mod}.`;
    var msg_nomatch_str = `error: I did not recognise the user \`${this.mention.str}\` you specified. 
    Please specify the user by their mention name (example: \`/assign 9999 ${this.mention_mod}\`). If the issue persists, contact ${this.mention_mod}.`;
    
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
    this.immediateReturnMessage = "Thank you for your message. I\'m a poor bot so please be patient... it should take me up to a few minutes to get back to you...";
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
      throw new Error(textToJsonBlocks(`error: The \`assign\` command can only be used by <@${mod_userid}>.`));
    }
    
    this.args.parseUniqueID();
    this.args.parseMentionString();
  }
  
  formulateUserResponse(){
    return textToJsonBlocks(`Assigning volunteer on behalf...`);
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
    var out_message = `<@${this.row.slackVolunteerID}> has volunteered. :tada:`;
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
    var out_message = `<!channel> <@${this.slackVolunteerID_old}> is no longer available for ${requestFormatted(this.row)}. Can anyone else help? Type \`/volunteer ${this.row.uniqueid} \``;
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
    return textToJsonBlocks(`A request completion form will open in less than 3 seconds... If not, please type \`/done ${this.args.uniqueid}\` again.`);
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
    var out_message = `Thanks for helping out <@${this.row.slackVolunteerID}>! :nerd_face:`;
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
    var message_out = 'These are the help requests in this channel still awaiting a volunteer:\n';

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
    var message_out = 'These are all the active requests in this channel:\n';

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
    var message_out = 'These are all the requests posted in this channel:\n';

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
    var message_out = 'These are the active help requests you are assigned to in this channel:\n';

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
 *  Manage a listmine command from user or moderator
 */
class ListAllMineCommand extends Command {
  
  getSheetData(){
    this.rows = this.tracking_sheet.getAllRows();
  }
  
  formulateUserResponse(){
    var message_out = 'These are all the help requests you volunteered for in this channel:\n';

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