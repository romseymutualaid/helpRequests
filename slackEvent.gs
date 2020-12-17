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
  var {token, teamid, type, cmd} = slackEventAdapter(e);
  return new SlackEventController(token, teamid, type, cmd);
}

/**
 * Return an adapter function given a doPost event object e.
 * For details on slack events see https://api.slack.com/interactivity/entry-points
 * @param {*} e An event object.
 */
var slackEventAdapter = function(e) {
  if (e.parameter.payload) { // this is a slack interactive component event
    var payload = JSON.parse(e.parameter.payload);
    switch (payload.type) {
      case 'shortcut':
        return slackGlobalShortcutAdapter(e);
      case 'view_submission':
        return slackModalSubmissionAdapter(e);
      case 'block_actions':
        return slackButtonAdapter(e);
      default:
        throw new Error(slackEventTypeIsIncorrectMessage(payload.type));
    }
  } else if (e.parameter.command) { // this is a slack slash command event
    return slackSlashCommandAdapter(e);
  } else {
    var payload = tryParseJSON(e.postData.contents);
    switch (payload.type) {
      case "url_verification":
        return slackUrlVerificationAdapter(e);
      case "event_callback":
        return slackHomeOpenedAdapter(e);
      default:
        throw new Error(slackEventTypeIsIncorrectMessage(payload.type));
    }
  }
}

/**
 * Return SlackEvent arguments given a SlackModalSubmission event object.
 * @param {*} e A Slack "view_submission" event object. See
 *   https://api.slack.com/reference/interaction-payloads/views#view_submission
 */
var slackModalSubmissionAdapter = function(e) {
  var payload = JSON.parse(e.parameter.payload);
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
 * Return SlackEvent arguments given a SlackGlobalShortcut event object.
 * @param {*} e A Slack "message_actions" of type "shortcut" event object. See
 *   https://api.slack.com/reference/interaction-payloads/shortcuts#message_actions
 */
var slackGlobalShortcutAdapter = function(e) {
  var payload = JSON.parse(e.parameter.payload);
  return {
    token: payload.token,
    teamid: payload.team.id,
    type: payload.type,
    cmd: createCommandClassInstance(args = {
      cmd_name: payload.callback_id,
      channelid: null,
      userid: payload.user.id,
      username: null,
      response_url: null,
      trigger_id: payload.trigger_id,
      uniqueid: null,
      mention: {str: null, userid: null, username: null},
      more: null
    })
  };
}

/**
 * Return SlackEvent arguments given a SlackVerificationUrl event object.
 * @param {*} e A Slack "Events API" of type "url_verification" event object. See
 *   https://api.slack.com/events/url_verification
 */
var slackUrlVerificationAdapter = function(e) {
  var payload = JSON.parse(e.postData.contents);
  return {
    token: payload.token,
    teamid: null,
    type: payload.type,
    cmd: createCommandClassInstance(args = {
      cmd_name: payload.type,
      channelid: null,
      userid: null,
      username: null,
      response_url: null,
      trigger_id: null,
      uniqueid: null,
      mention: {str: null, userid: null, username: null},
      more: {"challenge": payload.challenge}
    })
  };
}

/**
 * Return SlackEvent arguments given a SlackHomeOpened event object.
 * @param {*} e A Slack "Events API" of type "app_home_opened" event object. See
 *   https://api.slack.com/events/app_home_opened
 *   https://api.slack.com/events-api#begin
 */
var slackHomeOpenedAdapter = function(e) {
  var payload = JSON.parse(e.postData.contents);
  return {
    token: payload.token,
    teamid: payload.team_id,
    type: payload.type,
    cmd: createCommandClassInstance(args = {
      cmd_name: payload.event.type,
      channelid: payload.event.channel,
      userid: payload.event.user,
      username: null,
      response_url: null,
      trigger_id: null,
      uniqueid: null,
      mention: {str: null, userid: null, username: null},
      more: {"tab": payload.event.tab}
    })
  };
}

/**
 * Return SlackEvent arguments given a SlackButton event object.
 * @param {*} e A Slack "blocks-action" of type "button" event object. See
 *   https://api.slack.com/reference/interaction-payloads/block-actions
 *   https://api.slack.com/legacy/message-buttons
 */
var slackButtonAdapter = function(e) { 
  var payload = JSON.parse(e.parameter.payload);
  var channel_id = payload.channel !== undefined ? payload.channel.id : null;
  return {
    token: payload.token,
    teamid: payload.team.id,
    type: payload.type,
    cmd: createCommandClassInstance(args = {
      cmd_name: payload.actions[0].action_id,
      channelid: channel_id,
      userid: payload.user.id,
      username: payload.user.name,
      response_url: payload.response_url,
      trigger_id: payload.trigger_id,
      uniqueid: payload.actions[0].value,
      mention: {str: null, userid: null, username: null},
      more: null
    })
  };
}

/**
 * Return SlackEvent arguments given a SlackSlashCommand event object.
 * @param {*} e A Slack slash command event object. See
 *   https://api.slack.com/interactivity/slash-commands#app_command_handling
 */
var slackSlashCommandAdapter = function(e) {
  var payload = e.parameter;
  uniqueid = null;
  mention_str = null;
  if (payload.text) {
    [uniqueid, mention_str] = payload.text.split(' ');
  }
  
  return {
    token: payload.token,
    teamid: payload.team_id,
    type: "command",
    cmd: createCommandClassInstance(args = {
      cmd_name: payload.command,
      channelid: payload.channel_id,
      userid: payload.user_id,
      username: payload.user_name,
      response_url: payload.response_url,
      trigger_id: payload.trigger_id,
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
    // Check token
    var token_true = PropertiesService.getScriptProperties().getProperty(
      'VERIFICATION_TOKEN'); // expected slack API verification token.
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