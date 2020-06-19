// Methods and classes to return or post messages to slack API

/**
 * Encapsulate string as a JSON response
 * @param {string} message
 */
function contentServerJsonReply(message) {
  // "ContentServer" reply as Json.
  return ContentService
         .createTextOutput(message)
         .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Post to slack.
 * @param {string} payload
 * @param {string} url
 */
var postToSlack = function(payload, url){
    
  if (JSON.parse(payload).as_user === true){
    var access_token = PropertiesService
                      .getScriptProperties()
                      .getProperty('ACCESS_TOKEN_USER');
  } else {
    var access_token = PropertiesService
                      .getScriptProperties()
                      .getProperty('ACCESS_TOKEN');
  }

  var options = {
    method: "post",
    contentType: 'application/json; charset=utf-8',
    headers: {Authorization: 'Bearer ' + access_token},
    payload: payload
  };

  return UrlFetchApp
        .fetch(url, options)
        .getContentText();
}

/*** CONSTRUCTORS ***/

/**
 *  Return the appropriate SlackMessenger subclass instance based on the specified slackCmdString (i.e. event origin).
 * @param {*} slackCmdString
 */
var createMessengerClassInstance = function(slackCmdString){
  
//  SYNC_COMMANDS: [
//      'shortcut_app_home',
//      'button_done',
//      '/jb_d',
//      '/ib_d',
//      '/_done',
//      '/done'
//    ],
//  
//  SUBCLASS_FROM_SLACKCMD: {
//      undefined:VoidCommand, VoidMessenger-
//      null:VoidCommand, VoidMessenger-
//      '':VoidCommand, VoidMessenger-
//      'shortcut_app_home':HomeShortcutCommand, SlackModalMessenger-
//      'app_home_opened':HomeOpenedCommand, VoidMessenger-SlackAppHomeMessenger
//      'button_volunteer':VolunteerCommand, VoidMessenger-SlackResponseUrlMessenger
//      'button_cancel':CancelCommand, SlackTriggerIdMessenger-SlackModalMessenger
//      'button_done':DoneSendModalCommand, VoidMessenger-SlackModalMessenger
//      'modal_done':DoneCommand,
//      '/volunteer':VolunteerCommand,
//      '/assign':AssignCommand, SlackResponseUrlMessenger
//      '/cancel':CancelCommand,
//      '/done':DoneSendModalCommand,
//      '/list':ListCommand,
//      '/listactive':ListActiveCommand,
//      '/listall':ListAllCommand,
//      '/listmine':ListMineCommand,
//      '/listallmine':ListAllMineCommand,
//      '/_volunteer':VolunteerCommand,
//      '/_assign':AssignCommand,
//      '/_cancel':CancelCommand,
//      '/_done':DoneSendModalCommand,
//      '/_list':ListCommand,
//      '/_listactive':ListActiveCommand,
//      '/_listall':ListAllCommand,
//      '/_listmine':ListMineCommand,
//      '/_listallmine':ListAllMineCommand,
//      '/jb_l':ListCommand,
//      '/jb_lac':ListActiveCommand,
//      '/jb_la':ListAllCommand,
//      '/jb_lm':ListMineCommand,
//      '/jb_lam':ListAllMineCommand,
//      '/jb_v':VolunteerCommand,
//      '/jb_c':CancelCommand,
//      '/jb_d':DoneSendModalCommand,
//      '/jb_a':AssignCommand,
//      '/ib_v':VolunteerCommand,
//      '/ib_c':CancelCommand,
//      '/ib_d':DoneSendModalCommand
//    },
//  
//  
//  switch (slackCmdString){
//      case 
//  }
//  
//  
//  
//  var SUBCLASS_FROM_SLACKCMD = globalVariables().SUBCLASS_FROM_SLACKCMD;
//  
//  if (!SUBCLASS_FROM_SLACKCMD.hasOwnProperty(slackCmdString)){ // if no key is found for slackCmdString, return error
//    throw new Error(commandNotSupportedMessage(slackCmdString));
//  }
//  if (typeof SUBCLASS_FROM_SLACKCMD[slackCmdString] !== 'function'){
//    throw new Error(commandNotConnectedMessage(slackCmdString));
//  }
//  if (typeof args !== 'object' || args === null){
//    throw new Error(commandArgumentsAreCorruptedMessage());
//  }
//  
//  return new SUBCLASS_FROM_SLACKCMD[slackCmdString](args);
}

/*** LOGIC ***/

/**
 * Wrapper classes to post to specific slack API urls and log the response.
 * @param {Command} cmd
 * @param {string} msg
 */
class SlackMessenger {
  constructor(cmd){
    this.cmd = cmd;
    this.url = null;
    this.loggerMessage={
      uniqueid:this.cmd.args.uniqueid,
      userid:'admin',
      type:'slackResponse',
      subtype:'',
      additionalInfo:''
    };
  }
  
  decoratePayload(payload){
    return payload;
  }
  
  send(payload){
    var payload = this.decoratePayload(payload);
    var return_message = postToSlack(payload, this.url);
    this.loggerMessage.additionalInfo = return_message;
    this.cmd.log_sheet.appendFormattedRow(this.loggerMessage);
    return return_message;
  }
}

class VoidMessenger extends SlackMessenger {
  send(payload){
  }
}

//class SlackReturnMessenger extends SlackMessenger {
//  constructor(cmd){
//    super(cmd);
//    this.loggerMessage.subtype='userSync';
//  }
//  
//  send(payload){
//  }
//  
//  decoratePayload(payload){
//    var payloadObj = JSON.parse(payload);
//    if(payloadObj.blocks){
//      // this is a non-modal block message.
//      // decorate with ephemeral properties.
//      payloadObj["response_type"] = "ephemeral";
//      payloadObj["replace_original"] = false;
//    }
//    return JSON.stringify(payloadObj);
//  }
//}

class SlackResponseUrlMessenger extends SlackMessenger {
  constructor(cmd){
    super(cmd);
    this.url = this.cmd.args.response_url;
    if (!this.url){ // if no url is specified, instantiate a VoidMessenger instead.
      return new VoidMessenger(cmd);
    }
    this.loggerMessage.subtype='userAsync';
  }
  
  decoratePayload(payload){
    var payloadObj = JSON.parse(payload);
    payloadObj["response_type"] = "ephemeral";
    payloadObj["replace_original"] = false;
    return JSON.stringify(payloadObj);
  }
}

class SlackChannelMessenger extends SlackMessenger {
  constructor(cmd){
    super(cmd);
    this.url = globalVariables()['WEBHOOK_CHATPOSTMESSAGE'];
    this.loggerMessage.subtype='channel';
  }
}

class SlackChannelUpdateMessenger extends SlackMessenger {
  constructor(cmd){
    super(cmd);
    this.url = globalVariables()['WEBHOOK_CHATUPDATE'];
    this.loggerMessage.subtype='channelUpdate';
  }
}

class SlackModalMessenger extends SlackMessenger {
  constructor(cmd){
    super(cmd);
    this.url = globalVariables()['WEBHOOK_VIEWOPEN'];
    this.loggerMessage.subtype='modal';
  }
}

class SlackModalUpdateMessenger extends SlackMessenger {
  constructor(cmd){
    super(cmd);
    this.url = globalVariables()['WEBHOOK_VIEWUPDATE'];
    this.loggerMessage.subtype = 'modalUpdate';
  }
}

class SlackAppHomeMessenger extends SlackMessenger {
  constructor(cmd){
    super(cmd);
    this.url = globalVariables()['WEBHOOK_VIEWPUBLISH'];
    this.loggerMessage.subtype='appHome';
  }
}