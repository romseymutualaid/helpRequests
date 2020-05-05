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
      var syntaxCheck = this.checkArgSyntax();
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
  
  
  checkArgSyntax(){
    // check syntax of this.args depending on function to be called
    
    // match doPost event.subtype with the function it is meant to call
    var fctName = this.slackCmd2FctName();
    if (!fctName){
      return ('error: Sorry, the `' + this.subtype + '` command is not currently supported.');;
    }
    
    // initialise output variable
    var output = {code:false, msg:''};
    
    // check uniqueid syntax
    var uniqueid_fcts = ['assign', 'volunteer', 'cancel', 'done_send_modal','done_process_modal'];
    if (uniqueid_fcts.indexOf(fctName) > -1){ // check if fctName is expected to pass the uniqueid argument
      var checkUniqueId_output = this.checkArgSyntaxRegexp("uniqueid");
      if (!checkUniqueId_output.code){
        output.msg += '\n' + checkUniqueId_output.msg;
      }
    }
    
    // check mention syntax
    var mention_fcts = ['assign'];
    if (mention_fcts.indexOf(fctName) > -1){ // check if fctName is expected to pass the mentionName argument
      var checkUniqueId_output = this.checkArgSyntaxRegexp("mention");
      if (!checkMention_output.code){
        output.msg += '\n' + checkMention_output.msg;
      }
    }
    
    // format output variable
    if (output.msg !== ''){ // if any error was picked up, wrap
      output.msg = 'I wasn\'t able to process your command for the following reasons:' + output.msg;
    } else{
      output.code = true;
    }
    return output;
  }
  
  checkArgSyntaxRegexp(argname){
    // checkArgSyntaxRegexp: check that a particular arg matches a regexp
    
    // load global variables
    var globvar = globalVariables();
    var mod_userid = globvar['MOD_USERID'];
    var mention_mod = '<@'+mod_userid+'>';
    
    var syntax_object={
      "uniqueid":{
        arg:this.args.uniqueid,
        regexp:"^[0-9]{4}$",
        fail_msg_empty:'error: You must mention a user that the command applies to. Example: `/assign 9999 ' + mention_mod  + '`.'+
                    'You appear to have not mentioned anyone. If the issue persists, please contact ' + mention_mod + '.',
        fail_msg_nomatch:'error: I did not recognise the user `'+this.args.uniqueid+'` you specified. Please specify the user by their mention name. Example: `/assign 9999 ' + mention_mod  + '`.'
      },
      "mention":{
        arg:this.args.mention.str,
        regexp:"<@(U[A-Z0-9]+)\\|?(.*)>",
        fail_msg_empty:'error: I did not recognise the user `'+this.args.mention.str+'` you specified. Please specify the user by their mention name. Example: `/assign 9999 ' + mention_mod  + '`.',
        fail_msg_nomatch:'error: You must mention a user that the command applies to. Example: `/assign 9999 ' + mention_mod  + '`.'+
                    'You appear to have not mentioned anyone. If the issue persists, please contact ' + mention_mod + '.'
      }
    };
    
    // initialise output object
    var output = {code:false, msg:syntax_object[argname].fail_msg_nomatch};
    
    // personalise error message if arg was not specified at all
    if (!syntax_object[argname].arg || syntax_object[argname].arg == ''){
      output.msg = syntax_object[argname].fail_msg_empty;
      return output;
    }
    
    // regexp match arg
    var re = new RegExp(syntax_object[argname].regexp); 
    var re_match = re.exec(syntax_object[argname].arg); // RegExp.exec returns array if match (null if not). First element is matched string, following elements are matched groupings.
    if (re_match){
      output.code = true;
      output.msg='';
      if (argname === 'mention'){ // parse userid and username from user mention string
        this.args.mention.userid = re_match[1];
        this.args.mention.username = re_match[2];
      }
    }
    
    return output;
  }
  
  
  
  handleEvent (){
    // handle slack doPost events
    
    // match doPost event.subtype with the function it is meant to call
    var fctName = this.slackCmd2FctName();
    if (!fctName){
      return contentServerJsonReply('error: Sorry, the `' + this.subtype + '` command is not currently supported.');
    }
  
    // check that function exists in global scope
    if (!GlobalFuncHandle[fctName]){
      return contentServerJsonReply('error: Sorry, the `' + this.subtype + '` command is not properly connected on the server. Please contact the web app developer.');
    }
    
    // check command validity
    this.checkCmdValidity();
    
    
    // call function by name
//    return contentServerJsonReply(GlobalFuncHandle[fctName](this.args));
    return GlobalFuncHandle[fctName](this.args);    
  }
  
  checkCmdValidity(){
    //**** todo ****//
    
  }  
  
}
