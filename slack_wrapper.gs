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

    this.args={
      channelid:null, // channel_id that event originates from
      userid:null, // user_id from whom the event originates
      username:null, // (optional) user_name associated to this.userid
      response_url:null, // POST url to provide delayed response to user
      trigger_id:null, // needed to generate interactive messages in response to event
      uniqueid:null, // (optional) help request number
      mention:{str:null, userid:null, username:null}, // (optional) markdown-formatted mention name
      more:null // (optional) space for extra arguments
    };
  }

  checkAuthenticity(){
    // fetch validation variables
    var globvar = globalVariables();
    var teamid_true =  globvar['TEAM_ID'];
    var token_true = PropertiesService.getScriptProperties().getProperty('VERIFICATION_TOKEN'); // expected verification token that accompanies slack API request

    // check token
    if(!token_true){ // check that token_true has been set in script properties
      throw new Error('error: VERIFICATION_TOKEN is not set in script properties. The command will not run. Please contact the web app developer.');
    }
    if (this.token !== token_true) {
      throw new Error('error: Invalid token ' + this.token + ' . The command will not run. Please contact the web app developer.');
    }

    // check request originates from our slack workspace
    if (this.teamid != teamid_true){
      throw new Error('error: You are sending your command from an unauthorised slack workspace.');
    }
  }

  checkSyntax(){
    // check syntax of this.type, this.subtype, and this.args depending on function to be called

    // check this.type
    var accepted_types = ['view_submission', 'command'];
    if(accepted_types.indexOf(this.type) < 0){ // if this.type does not match any accepted_types, return error
      throw new Error(`error: I can't handle the event type ${this.type}.`);
    }

    // match doPost this.subtype with the class it is meant to instantiate
    var SUBCLASS_FROM_SLACKCMD = globalVariables().SUBCLASS_FROM_SLACKCMD;
    if (!SUBCLASS_FROM_SLACKCMD.hasOwnProperty(this.subtype)){ // if no key is found for this.subtype, return error
      throw new Error(`error: The \`${this.subtype}\` command is not currently supported.`);
    }
    if (typeof SUBCLASS_FROM_SLACKCMD[this.subtype] !== 'function'){
      throw new Error(`error: The \`${this.subtype}\` command is not properly connected on the server.
                    Can you please notify a developer?`);
    }

    // check argument syntax for fctName. 
    // todo: move this into Command subclasses? or at the least change dependency from fctName to subclassName
    var fctName = globalVariables().SLACKCMD_TO_FUNCTIONNAME[this.subtype];
    if (!fctName){ // this check is already done in parsing. added here in case corruption occurs during event queuing
      throw new Error('error: Sorry, the `' + this.subtype + '` command is not currently supported.');
    }
    this.checkArgSyntaxRegexp(fctName);
  }

    //// todo: argSyntaxRegexp methods are Arg Class methods (one per arg to check). Each ConcreteCommand has an Arg object and calls relevant arg.methods().
  checkArgSyntaxRegexp(fctname){
    // checkArgSyntaxRegexp: check that a particular function fctname has all the correct args by regexp matching

    // load global variables
    var globvar = globalVariables();
    var mod_userid = globvar['MOD_USERID'];
    var mention_mod = '<@'+mod_userid+'>';

    // define all args to check, the functions where they are expected, the regexp they should match and all possible error messages
    var syntax_object={
      "uniqueid":{
        arg:this.args.uniqueid,
        regexp:"^[0-9]{4}$",
        fcts:['assign', 'volunteer', 'cancel', 'done_send_modal','done'], // functions this argument is expected in
        fail_msg_empty:'error: You must provide the request number present in the help request message (example: `/volunteer 9999`). '+
                                           'You appear to have not typed any number. If the issue persists, contact ' + mention_mod + '.',
        fail_msg_nomatch:'error: The request number `'+this.args.uniqueid+'` does not appear to be a 4-digit number as expected. '+
                                           'Please specify a correct request number. Example: `/volunteer 9999`.'
      },
      "mention":{
        arg:this.args.mention.str,
        regexp:"<@(U[A-Z0-9]+)\\|?(.*)>",
        fcts:['assign'],
        fail_msg_empty:'error: You must mention a user that the command applies to. Example: `/assign 9999 ' + mention_mod  + '`.'+
                    'You appear to have not mentioned anyone. If the issue persists, please contact ' + mention_mod + '.',
        fail_msg_nomatch:'error: I did not recognise the user `'+this.args.mention.str+'` you specified. Please specify the user by their mention name. Example: `/assign 9999 ' + mention_mod  + '`.'
      }
    };

    // iterate check over all potential arguments in syntax_object
    var msg = ''; // initialise exception message
    Object.keys(syntax_object).forEach(function(key,index) { // iterate over the object properties of cmd_state_machine.command[cmd].status
    // key: the name of the object property

      // move to next iteration (i.e. next arg to check) if fctname does not expect the argument syntax_object[key]
      if(syntax_object[key].fcts.indexOf(fctname) < 0){
        return;
      }

      // if argument is expected, check syntax. If wrong syntax, append appropriate error message. If correct syntax and if relevant, do some parsing.

      if (!syntax_object[key].arg || syntax_object[key].arg == ''){ // personalise error message if arg was not specified at all
        msg += '\n' + syntax_object[key].fail_msg_empty;
      } else{

        // regexp match arg
        var re = new RegExp(syntax_object[key].regexp);
        var re_match = re.exec(syntax_object[key].arg); // RegExp.exec returns array if match (null if not). First element is matched string, following elements are matched groupings.

        if (!re_match){ // if arg did not match syntax, add to error message
          msg += '\n' + syntax_object[key].fail_msg_nomatch;
        } else { // or do some optional parsing if successful
          if (key === 'mention'){ // parse userid and username from user mention string
            this.args.mention.userid = re_match[1];
            this.args.mention.username = re_match[2];
          }
        }
      }
    }, this); // make sure to pass this in forEach to maintain scope

    if (msg !== ''){ // if any syntactic error was picked up, wrap and throw exception
      msg = 'I wasn\'t able to process your command for the following reasons:' + msg;
      throw new Error(msg);
    }
  }

  handleEvent (){
    // handle slack doPost event

    // Process Command
    if (globalVariables()["SYNC_COMMANDS"].indexOf(this.subtype) != -1){
      // Handle Sync
      var immediateReturnMessage = processFunctionSync(this.subtype, this.args);
    } else {
      // Handle Async
      if(this.subtype==='done_modal'){
        var immediateReturnMessage = null; // modal requires a blank HTTP 200 OK immediate response to close
      } else{
      var immediateReturnMessage = "Thank you for your message. I\'m a poor bot so please be patient... it should take me up to a few minutes to get back to you...";
      }
      processFunctionAsync(this.subtype, this.args);
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

    this.args.channelid = metadata_parsed.channelid;
    this.args.userid = par.user.id;
    this.args.response_url = metadata_parsed.response_url;

    this.args.uniqueid = metadata_parsed.uniqueid;
    this.args.more = par.view.state.values;
  }
}

class SlackSlashCommandEvent extends SlackEventWrapper {
  constructor(par){
    super();
    this.token = par.token;
    this.teamid = par.team_id;

    this.type = 'command';
    this.subtype = par.command;

    this.args.channelid = par.channel_id;
    this.args.userid = par.user_id;
    this.args.username = par.user_name;
    this.args.response_url = par.response_url;
    this.args.trigger_id = par.trigger_id;

    if(par.text){
      [this.args.uniqueid, this.args.mention.str] = par.text.split(' ');
    }
  }

}