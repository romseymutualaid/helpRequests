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
      more: payload.view.state.values
    })
  }
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
    var teamid_true =  globalVariables()['TEAM_ID'];
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
    if (this.teamid !== teamid_true){
      throw new Error(slackWorspaceIsIncorrectMessage());
    }
    
    // Check syntax of this.type
    if(!isVarInArray(this.type, accepted_types)){
      throw new Error(slackEventTypeIsIncorrectMessage(this.type));
    }
    
    // Parse command+args
    this.cmd.parse();
  }
  
  handle() {
    var immediateReturnMessage = this.cmd.run();    
    return immediateReturnMessage;
  }
}