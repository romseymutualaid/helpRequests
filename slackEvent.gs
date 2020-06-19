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
 *  Return the appropriate SlackEvent subclass instance based on the specified event object e.
 *  For details on slack events see:
 *  https://api.slack.com/interactivity
 * @param {*} e
 */
var createSlackEventClassInstance = function(e) {
  // extract event message body
  var par = e.parameter;

  // build the appropriate object depending on event type
  var payload_str = par.payload;
  if (payload_str){
    // this is a slack interactive component event
    var payload = JSON.parse(payload_str);
    switch (payload.type){
      case 'shortcut':
        return new SlackGlobalShortcutEventController(payload);
      case 'view_submission':
        return new SlackInteractiveMessageEventController(payload);
      case 'block_actions':
        return new SlackButtonEventController(payload);
      default:
        return new SlackUnsupportedEventController(payload);
    }
  } else{ 
    var par_raw = tryParseJSON(e.postData.contents);
    if (par_raw.type === 'url_verification'){
      // this is a slack url verification event 
      return new SlackUrlVerificationEventController(par_raw);
    } else if (par_raw.type === 'event_callback'){
      // this is a slack API event
      return new SlackAPIEventController(par_raw);      
    } else if (par.command) {
      // this is a slack slash command event
      return new SlackSlashCommandEventController(par);
    } else {
      return new SlackUnsupportedEventController({"type":"type_unknown"});
    }
  }
}


/*** LOGIC ***/

class SlackEventController {
  // Controller for slack doPost events

  constructor(par){
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
    
    this.cmd = createCommandClassInstance(this.subtype, args); // Command class instance returned by createCommandClassInstance(this.subtype, args)
    this.SlackMessengerBehaviour = new VoidMessenger(this.cmd);
  }

  parse(){
    // Fetch validation variables
    var token_true = PropertiesService.getScriptProperties().getProperty('VERIFICATION_TOKEN'); // expected verification token that accompanies slack API request
    
    // Check token
    if(!token_true){ // check that token_true has been set in script properties
      throw new Error(slackTokenNotSetInScriptMessage());
    }
    if (this.token !== token_true) {
      throw new Error(slackTokenIsIncorrectMessage(this.token));
    }
    
    // Parse command+args
    this.cmd.parse();
  }

  handle(){
    // Process Command
    
    if (!this.cmd instanceof VoidCommand){
      if (isVarInArray(this.subtype,globalVariables()["SYNC_COMMANDS"])){
        // Handle Sync
        this.cmd.immediateReturnMessage = this.cmd.execute(); 
      } else {
        // Handle Async
        processFunctionAsync(this.subtype, this.cmd.args);
      }
    }
    
    return this.cmd.immediateReturnMessage;
  }
  
  decorateResponse(payload){
    // Decorate Command response accordingly
    return this.SlackMessengerBehaviour.decoratePayload(payload);
  }
}

class SlackUnsupportedEventController extends SlackEventController {
  constructor(par){
    super(par);
    this.token = par.token;
    this.cmd.immediateReturnMessage = slackEventTypeIsIncorrectMessage(par.type);
  }
}

class SlackUrlVerificationEventController extends SlackEventController {
  constructor(par){
    super(par);
    this.token = par.token;
    this.cmd.immediateReturnMessage = par.challenge;
  }
}

class SlackAPIEventController extends SlackEventController {
  constructor(par){
    super(par);
    this.token = par.token;
    this.teamid = par.team_id;
    
    this.type = 'event_callback';
    this.subtype = par.event.type;
    
    var args = {};
    args.channelid = par.event.channel;
    args.userid = par.event.user;
    args.more = {"tab": par.event.tab};
    
    this.cmd = createCommandClassInstance(this.subtype, args);
  }
}

class SlackGlobalShortcutEventController extends SlackEventController {
  constructor(par){
    super(par);
    this.token = par.token;
    this.teamid = par.team.id;

    this.type = par.type;
    this.subtype = par.callback_id;
    
    var args={};
    args.userid = par.user.id;
    args.trigger_id = par.trigger_id;
    
    this.cmd = createCommandClassInstance(this.subtype, args);
  }
}

class SlackInteractiveMessageEventController extends SlackEventController {
  constructor(par){
    super(par);
    console.log(par);
    this.token = par.token;
    this.teamid = par.team.id;

    this.type = par.type;
    this.subtype = par.view.callback_id;

    var metadata_parsed = JSON.parse(par.view.private_metadata);

    var args={};
    args.channelid = metadata_parsed.channelid;
    args.userid = par.user.id;
    args.response_url = metadata_parsed.response_url;
    args.trigger_id = par.trigger_id;

    args.uniqueid = metadata_parsed.uniqueid;
    args.more = {"modalResponseValues": par.view.state.values};
    
    this.cmd = createCommandClassInstance(this.subtype, args);
  }
}

class SlackSlashCommandEventController extends SlackEventController {
  constructor(par){
    super(par);
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

class SlackButtonEventController extends SlackEventController {
  constructor(par){
    super(par);
    
    this.token = par.token;
    this.teamid = par.team.id;

    this.type = par.type;
    this.subtype = par.actions[0].action_id;

    var args={};
    if (par.channel) args.channelid = par.channel.id;
    args.userid = par.user.id;
    args.username = par.user.name;
    args.response_url = par.response_url;
    args.trigger_id = par.trigger_id;

    args.uniqueid = par.actions[0].value;
    
    this.cmd = createCommandClassInstance(this.subtype, args);
  }
}