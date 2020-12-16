/**
 * @fileoverview Unpack and process slack event objects.
 * Events objects are fed to SlackEventController through
 * an appropriate adapter function.
 * SlackEventController parses and runs the event.
 */

/*** CONSTRUCTORS ***/

/**
 * Return a slackEvent object given a doPost event object e.
 * @param {*} e A doPost event object. See
 *   https://developers.google.com/apps-script/guides/web
 */
var createSlackEvent = function(e) {
  var adapter = getEventAdapter(e);
  var {token, teamid, type, cmd} = adapter(e.parameter);
  return new SlackEventController(token, teamid, type, cmd);
}

/**
 * Return an adapter function given a doPost event object e.
 * For details on slack events see https://api.slack.com/interactivity/entry-points
 * @param {*} e An event object.
 */
var getEventAdapter = function(e) {
  if (e.parameter.payload) { // this is a slack interactive component event
    return slackInteractiveMessageAdapter;
  } else { // this is a slack slash command event
    return slackSlashCommandAdapter;
  }
}

/**
 * Return SlackEvent arguments given a SlackInteractiveMessage parameters object.
 * @param {*} par A Slack interactive message parameters object. See
 *   https://api.slack.com/reference/interaction-payloads/views#view_submission
 */
var slackInteractiveMessageAdapter = function(par) {
  var payload = JSON.parse(par.payload);
  var metadata = JSON.parse(payload.view.private_metadata);
  
  return {
    token: payload.token,
    teamid: payload.team.id,
    type: payload.type,
    cmd: createCommandClassInstance(args = {
      cmd_name: payload.view.callback_id,
      channelid: metadata.channelid,
      userid: payload.user.id,
      username: null,
      response_url: metadata.response_url,
      trigger_id: null,
      uniqueid: metadata.uniqueid,
      mention: {str: null, userid: null, username: null},
      more: {modalResponseValues: payload.view.state.values}
    })
  };
}

/**
 * Return SlackEvent arguments given a SlackSlashCommand parameters object.
 * @param {*} par A Slack slash command parameters object. See
 *   https://api.slack.com/interactivity/slash-commands#app_command_handling
 */
var slackSlashCommandAdapter = function(par) {
  uniqueid = null;
  mention_str = null;
  if (par.text) {
    [uniqueid, mention_str] = par.text.split(' ');
  }
  
  return {
    token: par.token,
    teamid: par.team_id,
    type: "command",
    cmd: createCommandClassInstance(args = {
      cmd_name: par.command,
      channelid: par.channel_id,
      userid: par.user_id,
      username: par.user_name,
      response_url: par.response_url,
      trigger_id: par.trigger_id,
      uniqueid: uniqueid,
      mention: {str: mention_str, userid: null, username: null},
      more: null
    })
  }
}


/*** LOGIC ***/

class SlackEventController {
  // Controller for slack doPost events
  
  constructor(token, teamid, type, cmd){    
    this.token = token; // Slack app verification token.
    this.teamid = teamid; // Slack workspace id.
    this.type = type; // Event type (slash command, interactive message, ...).
    this.cmd = cmd; // Command object.
    
    this.parse();
  }
  
  parse() {
    // Fetch validation variables
    var token_true = PropertiesService.getScriptProperties().getProperty(
      'VERIFICATION_TOKEN'); // expected slack API verification token.
    
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
  
  handle() {
    var immediateReturnMessage = this.cmd.run();    
    return immediateReturnMessage;
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
        throw new Error(slackEventTypeIsIncorrectMessage(payload.type));
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
      throw new Error(slackEventTypeIsIncorrectMessage("type_unknown"));
    }
  }
}