// Unpack and process slack event objects.
//
// Events are routed to a specific SlackEventController subclass.
// The SlackEventController subclass has a Command model behaviour that it calls
// synchronously (.execute() method) or asynchronously (handle_async.gs).
//
// Slack events currently supported:
// - slash commands (/volunteer, /cancel, etc.)
// - interactive messages (modals)


/*** CONSTRUCTORS ***/

/**
 * Return the appropriate SlackEvent subclass instance based on the specified 
 * event object e.
 * For details on slack events see https://api.slack.com/interactivity/
 * @param {*} e
 */
var createSlackEventClassInstance = function(e) {
  // extract event message body
  var par = e.parameter;
  
  // build the appropriate object depending on event type
  var payload = par.payload;
  if (payload){ // this is a slack interactive component event
    return new SlackInteractiveMessageEventController(JSON.parse(payload));
  } else{ // this is a slack slash command event
    return new SlackSlashCommandEventController(par);
  }
}


/*** LOGIC ***/

class SlackEventController {
  // Controller for slack doPost events

  constructor(par){
    // class template

    this.token=null; // slack app verification token string
    this.teamid=null; // slack workspace id

    this.type=null; // describes the high level type of event 
    // (slash command, interactive message, ...)
    this.subtype=null; // describes the lower level type of event
    // (slash command name, interactive message subtype, ...)

    var args={
      channelid:null, // channel_id that event originates from
      userid:null, // user_id from whom the event originates
      username:null, // (optional) user_name associated to this.userid
      response_url:null, // POST url to provide delayed response to user
      trigger_id:null, // needed to generate interactive messages in 
      // response to event
      uniqueid:null, // (optional) help request number
      mention:{str:null, userid:null, username:null}, // (optional) 
      // markdown-formatted mention name
      more:null // (optional) space for extra arguments
    };
    
    this.cmd = null; // Command class instance returned by 
    // createCommandClassInstance(this.subtype, args)
  }

  parse(){
    // Fetch validation variables
    var globvar = globalVariables();
    var teamid_true =  globvar['TEAM_ID'];
    var token_true = PropertiesService.getScriptProperties().getProperty(
      'VERIFICATION_TOKEN'); // expected slack API verification token.
    var accepted_types = ['view_submission', 'command'];
    
    // Check token
    if(!token_true){ // check that token_true has been set in script properties
      throw new Error(slackTokenNotSetInScriptMessage());
    }
    if (this.token !== token_true) {
      throw new Error(slackTokenIsIncorrectMessage(this.token));
    }

    // Check request originates from our slack workspace
    if (this.teamid != teamid_true){
      throw new Error(slackWorspaceIsIncorrectMessage());
    }
    
    // Check syntax of this.type
    if(!isVarInArray(this.type,accepted_types)){
      throw new Error(slackEventTypeIsIncorrectMessage(this.type));
    }
    
    // Parse command+args
    this.cmd.parse();
  }

  handle(){
    // Process Command
    
    if (isVarInArray(this.subtype,globalVariables()["SYNC_COMMANDS"])){
      // Handle Sync
      var immediateReturnMessage = this.cmd.execute(); 
    } else {
      // Handle Async
      var immediateReturnMessage = this.cmd.immediateReturnMessage;
      processFunctionAsync(this.subtype, this.cmd.args);
    }
    
    return immediateReturnMessage;
  }
}


class SlackInteractiveMessageEventController extends SlackEventController {
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

class SlackSlashCommandEventController extends SlackEventController {
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