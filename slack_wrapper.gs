class SlackEventWrapper {
  // Wrapper for slack doPost events

  constructor(e){
    // declaire the entire structure (for readability)

    this.token=null; // slack app verification token string
    this.teamid=null; // slack workspace id

    this.type=null; // describes the high level type of event (slash command, interactive message, ...)
    this.subtype=null; // describes the lower level type of event (slash command name, interactive message subtype, ...)

    this.argsString=null; // temporary var for backwards compatibility
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

  parseEvent(e){
    if (typeof e !== 'undefined'){
      // extract message body
      var par = e.parameter;

      // parse according to the nature of the doPost event
      var payload = par.payload;
      if (payload){ // if payload exists, this is a doPost event from a slack interactive component
        this.parseEventInteractiveMessage(JSON.parse(payload));
      } else{ // else, this is a doPost event from a slack slash command
        this.parseEventSlashCommand(par);
      }

      // quick check event authenticity
      var authenticityCheck = this.checkAuthenticity();
      if (!authenticityCheck.code){
        return authenticityCheck;
      }

      // quick check event syntax
      var syntaxCheck = this.checkSyntax();
      if (!syntaxCheck.code){
        return syntaxCheck;
      }

      return {code:true, msg:''}; // if all good, return success object
    }
  }

  parseEventInteractiveMessage(par){
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


  parseEventSlashCommand(par){
    this.token = par.token;
    this.teamid = par.team_id;

    this.type = 'command';
    this.subtype = par.command;

    this.args.channelid = par.channel_id;
    this.args.userid = par.user_id;
    this.args.username = par.user_name;
    this.args.response_url = par.response_url;
    this.args.trigger_id = par.trigger_id;

    this.argsString=par.text;
    this.parseEventSlashCommandTxt(par.text); // populates this.args
  }

  parseEventSlashCommandTxt(txt){
    // parse txt string and store parsed values in this.args
    if(txt) {
      var args = txt.split(' ');
      this.args.uniqueid = args[0]; // if uniqueid is specified, it is always the first argument
      this.args.mention.str = args[1]; // if user mention is specified, it is always the second argument
    }
  }


  checkAuthenticity(){
    // fetch validation variables
    var globvar = globalVariables();
    var teamid_true =  globvar['TEAM_ID'];
    var token_true = PropertiesService.getScriptProperties().getProperty('VERIFICATION_TOKEN'); // expected verification token that accompanies slack API request

    // initialise return message
    var output = {code:false, msg:''};

    // check token
    if(!token_true){ // check that token_true has been set in script properties
      output.msg = 'error: VERIFICATION_TOKEN is not set in script properties. The command will not run. Please contact the web app developer.';
      return output;
    }
    if (this.token !== token_true) {
      output.msg = 'error: Invalid token ' + this.token + ' . The command will not run. Please contact the web app developer.';
      return output;
    }

    // check request originates from our slack workspace
    if (this.teamid != teamid_true){
      output.msg = 'error: You are sending your command from an unauthorised slack workspace.';
      return output;
    }

    output.code=true;
    return output;
  }


  slackCmd2FctName(){
    // match this.subtype with the function it is meant to call
    var slackCmd2FctName = globalVariables()['SLACKCMD_TO_FUNCTIONNAME']; // this is where all the key-value pairs (event.subtype - functionName) are stored
    if (!slackCmd2FctName.hasOwnProperty(this.subtype)){ // if no key is found for this.subtype, return error
        return false;
    }
    return slackCmd2FctName[this.subtype];
  }


  checkSyntax(){
    // check syntax of this.type, this.subtype, and this.args depending on function to be called

    // initialise output variable
    var output = {code:false, msg:''};

    // check this.type
    var accepted_types = ['view_submission', 'command'];
    if(accepted_types.indexOf(this.type) < 0){ // if this.type does not match any accepted_types, return error
      output.msg = 'error: I can\'t handle the event type "'+this.type+'".';
      return output;
    }

    // match doPost this.subtype with the function it is meant to call
    var fctName = this.slackCmd2FctName();
    if (!fctName){
      output.msg = 'error: Sorry, the `' + this.subtype + '` command is not currently supported.';
      return output;
    }

    // check that function associated to this.subtype exists in global scope
    if (!GlobalFuncHandle[fctName]){
      output.msg = 'error: Sorry, the `' + this.subtype + '` command is not properly connected on the server. Please contact the web app developer.';
      return output;
    }

    // check argument syntax for fctName
    return this.checkArgSyntaxRegexp(fctName);

  }

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
        fcts:['assign', 'volunteer', 'cancel', 'done_send_modal','done_process_modal'], // functions this argument is expected in
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

    // initialise output object
    var output = {code:false, msg:''};

    // iterate check over all potential arguments in syntax_object
    Object.keys(syntax_object).forEach(function(key,index) { // iterate over the object properties of cmd_state_machine.command[cmd].status
    // key: the name of the object property

      // move to next iteration (i.e. next arg to check) if fctname does not expect the argument syntax_object[key]
      if(syntax_object[key].fcts.indexOf(fctname) < 0){
        return;
      }

      // if argument is expected, check syntax. If wrong syntax, append appropriate error message. If correct syntax and if relevant, do some parsing.

      if (!syntax_object[key].arg || syntax_object[key].arg == ''){ // personalise error message if arg was not specified at all
        output.msg += '\n' + syntax_object[key].fail_msg_empty;
      } else{

        // regexp match arg
        var re = new RegExp(syntax_object[key].regexp);
        var re_match = re.exec(syntax_object[key].arg); // RegExp.exec returns array if match (null if not). First element is matched string, following elements are matched groupings.

        if (!re_match){ // if arg did not match syntax, add to error message
          output.msg += '\n' + syntax_object[key].fail_msg_nomatch;
        } else { // or do some optional parsing if successful
          if (key === 'mention'){ // parse userid and username from user mention string
            this.args.mention.userid = re_match[1];
            this.args.mention.username = re_match[2];
          }
        }
      }
    }, this); // make sure to pass this in forEach to maintain scope

    // format output variable
    if (output.msg !== ''){ // if any error was picked up, wrap
      output.msg = 'I wasn\'t able to process your command for the following reasons:' + output.msg;
    } else{
      output.code = true;
    }

    return output;
  }



  handleEvent (){
    // handle slack doPost events

    // match doPost event.subtype with the function it is meant to call
    var fctName = this.slackCmd2FctName();
    if (!fctName){ // this check is already done in parsing. added here in case corruption occurs during event queuing
      return contentServerJsonReply('error: Sorry, the `' + this.subtype + '` command is not currently supported.');
    }

    // check command validity
    this.checkCmdValidity();


    // Process Command
    if (fctName == "done_process_modal"){
      // done_process_modal is special: we need to reply with an empty string to
      // close the model, and the function then needs to be handled async.
      processFunctionAsync(
        fctName, this.args, this.args.response_url, null);
      return ContentService.createTextOutput("");

    } else if (globalVariables()["ASYNC_FUNCTIONS"].indexOf(fctName) != -1){
      // Handle Asyc
      var immediateReturnMessage = "Thank you for your message. I\'m a poor bot so please be patient... it should take me up to a few minutes to get back to you...";
      var reply_url = this.args.response_url;
      return processFunctionAsync(
        fctName, this.args, reply_url, immediateReturnMessage);

    } else {
      // Handle Sync
      return processFunctionSync(fctName, this.args);

    }
  }

  checkCmdValidity(){
    //**** todo ****//

  }

}
