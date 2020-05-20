/**
 *  Return the appropriate Command subclass instance based on the specified slackCmdString and args parameters.
 * @param {*} slackCmdString
 * @param {*} args
 */
var createCommandClassInstance = function(slackCmdString, args){
    var SUBCLASS_FROM_SLACKCMD = globalVariables().SUBCLASS_FROM_SLACKCMD;
    return new SUBCLASS_FROM_SLACKCMD[slackCmdString](args);
}




class Command {
  constructor(args){
    this.uniqueid = args.uniqueid;
    this.channelid = args.channelid;
    this.userid = args.userid;
    this.username = args.username;
    
    this.tracking_sheet = new TrackingSheetWrapper();
    this.log_sheet = new LogSheetWrapper();
  }
}


class VolunteerCommand extends Command {
  constructor(args){
    super(args);
  }
  
  checkSyntax(){
    //move slack_wrapper method here?
  }
  
  getSheetData(){
    this.row = this.tracking_sheet.getRowByUniqueID(this.uniqueid);
  }
  
  updateSheet(){
    // write userid, username and status to sheet
    this.row.slackVolunteerID = this.userid;
    this.row.slackVolunteerName = this.username;
    this.row.requestStatus = "Assigned";
    this.tracking_sheet.writeRow(this.row);
    
    // update log sheet
    this.log_sheet.appendRow([new Date(), this.uniqueid, this.userid,'slackCommand','volunteer']);
  }
  
  formulateUserResponse(){
    // todo: convert checkCommandValidity into a more modular function that each subclass can call with custom parameters defined here
    var cmd_check_msg = checkCommandValidity('volunteer',this.row,this.uniqueid,this.userid,this.channelid);
    return cmd_check_msg;
  }
  
  sendChannelResponse(){
    // reply to slack thread to confirm volunteer sign-up (chat.postMessage method)
    var out_message = `<@${this.userid}> has volunteered. :tada:`;
    var payload = JSON.stringify({
      text: out_message,
      thread_ts: this.row.slackTS,
      channel: this.channelid,
    });
    slackChannelReply(payload,this.uniqueid);
  }
}
