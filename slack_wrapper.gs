/**
 *  Return the appropriate SlackEvent subclass instance based on the specified event object e.
 * @param {*} e
 */
var createSlackEventClassInstance = function(e) {
  // extract event message body
  var par = e.parameter;
  
  // build the appropriate object depending on event type
  var payload = par.payload;
  if (payload){ // this is a slack interactive component event
    return new SlackInteractiveMessageEvent(JSON.parse(payload));
  } else{ // this is a slack slash command event
    return new SlackSlashCommandEvent(par);
  }
}

class SlackEventWrapper {
  // Wrapper for slack doPost events

  constructor(){
    // class template

    this.token=null; // slack app verification token string
    this.teamid=null; // slack workspace id

    this.type=null; // describes the high level type of event (slash command, interactive message, ...)
    this.subtype=null; // describes the lower level type of event (slash command name, interactive message subtype, ...)

    var args={
      channelid:null, // channel_id that event originates from
      userid:null, // user_id from whom the event originates
      username:null, // (optional) user_name associated to this.userid
      response_url:null, // POST url to provide delayed response to user
      trigger_id:null, // needed to generate interactive messages in response to event
      uniqueid:null, // (optional) help request number
      mention:{str:null, userid:null, username:null}, // (optional) markdown-formatted mention name
      more:null // (optional) space for extra arguments
    };
    
    this.cmd = null; // Command class instance returned by createCommandClassInstance(this.subtype, args)
  }

  checkAuthenticity(){
    // fetch validation variables
    var globvar = globalVariables();
    var teamid_true =  globvar['TEAM_ID'];
    var token_true = PropertiesService.getScriptProperties().getProperty('VERIFICATION_TOKEN'); // expected verification token that accompanies slack API request

    // check token
    if(!token_true){ // check that token_true has been set in script properties
      throw new Error(slackTokenNotSetInScriptMessage());
    }
    if (this.token !== token_true) {
      throw new Error(slackTokenIsIncorrectMessage(this.token));
    }

    // check request originates from our slack workspace
    if (this.teamid != teamid_true){
      throw new Error(slackWorspaceIsIncorrectMessage());
    }
  }

  checkSyntax(){
    // Check syntax of this.type and parse command+args

    var accepted_types = ['view_submission', 'command'];
    if(accepted_types.indexOf(this.type) < 0){ // if this.type does not match any accepted_types, return error
      throw new Error(slackEventTypeIsIncorrectMessage(this.type));
    }
    
    this.cmd.parse();
  }

  handle(){
    // Process Command
    
    if (globalVariables()["SYNC_COMMANDS"].indexOf(this.subtype) != -1){
      // Handle Sync
      var immediateReturnMessage = this.cmd.execute(); 
    } else {
      // Handle Async
      var immediateReturnMessage = this.cmd.immediateReturnMessage;
      processFunctionAsync(this.subtype, this.cmd.args);
    }
    
    return contentServerJsonReply(immediateReturnMessage);
  }
}


class SlackInteractiveMessageEvent extends SlackEventWrapper {
  constructor(par){
    super();
    this.token = par.token;
    this.teamid = par.team.id;

    this.type = par.type;
    this.subtype = par.view.callback_id;

    var metadata_parsed = JSON.parse(par.view.private_metadata);

    var args={};
    args.channelid = metadata_parsed.channelid;
    args.userid = par.user.id;
    args.response_url = metadata_parsed.response_url;

    args.uniqueid = metadata_parsed.uniqueid;
    args.more = par.view.state.values;
    
    this.cmd = createCommandClassInstance(this.subtype, args);
  }
}

class SlackSlashCommandEvent extends SlackEventWrapper {
  constructor(par){
    super();
    this.token = par.token;
    this.teamid = par.team_id;

    this.type = 'command';
    this.subtype = par.command;

    var args={};
    args.channelid = par.channel_id;
    args.userid = par.user_id;
    args.username = par.user_name;
    args.response_url = par.response_url;
    args.trigger_id = par.trigger_id;

    args.mention = {};
    if(par.text){
      [args.uniqueid, args.mention.str] = par.text.split(' ');
    }
    
    this.cmd = createCommandClassInstance(this.subtype, args);
  }

}