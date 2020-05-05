class SlackEventWrapper {
  // Wrapper for slack doPost events
  
  constructor(){
    // declaire the entire structure (for readability)
    
    this.token=null; // slack app verification token string
    this.teamid=null; // slack workspace id 
    
    this.type=null; // describes the high level type of event (slash command, interactive message, ...)
    this.subtype=null; // describes the lower level type of event (slash command name, interactive message subtype, ...) 
    
    this.channelid=null; // channel_id that event originates from
    this.userid=null; // user_id from whom the event originates 
    this.username=null; // user_name associated to this.userid
    this.response_url=null; // POST url to provide delayed response to user
    this.trigger_id=null; // needed to generate interactive messages in response to event
    
    this.argsString=null; // temporary var for backwards compatibility
    this.args={
      uniqueid:null, // help request number
      mentionName:null, // markdown-formatted mention name
      more:null // space for extra arguments
    };
    
  }
  
  parseEvent(e){
    if (typeof e !== 'undefined'){
      // extract message body
      var par = e.parameter; 
    
      // decide the nature of the doPost event
      var payload = par.payload;
      if (payload){ // if payload exists, this is a doPost event from a slack interactive component
        this.parseEventInteractiveMessage(JSON.parse(payload));
      } else{ // else, this is a doPost event from a slack slash command
        this.parseEventSlashCommand(par);
      }
    }    
  }
  
  parseEventInteractiveMessage(par){
    this.token = par.token;
    this.teamid = par.team.id;
    
    this.type = par.type; 
    this.subtype = par.view.callback_id;
    
    this.channelid = view.private_metadata.channelid;
    this.userid = par.user.id;
    this.response_url = view.private_metadata.response_url;
    
    this.args.uniqueid = view.private_metadata.uniqueid;
    this.args.more = view.state.values;    
  }
  
  
  parseEventSlashCommand(par){
    this.token = par.token;
    this.teamid = par.team_id;
    
    this.type = 'command';
    this.subtype = par.command;
    
    this.channelid = par.channel_id;
    this.userid = par.user_id;
    this.username = par.user_name;
    this.response_url = par.response_url;
    this.trigger_id = par.trigger_id
    
    this.argsString=par.text;
    this.parseEventSlashCommandArgs(par.text); // populate this.args
  }
  
  parseEventSlashCommandArgs(txt){
    // parse txt string and store parsed values in this.args
    if(txt) {
      var args = txt.split(' ');
      this.args.uniqueid = args[0]; // if uniqueid is specified, it is always the first argument
      this.args.mentionName = args[1]; // if mentionName is specified, it is always the second argument
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
      return(output);
    }  
    if (this.token !== token_true) {
      output.msg = 'error: Invalid token ' + this.token + ' . The command will not run. Please contact the web app developer.';
      return(output);
    }
    
    // check request originates from our slack workspace
    if (this.teamid != teamid_true){
      output.msg = 'error: You are sending your command from an unauthorised slack workspace.';
      return(output);
    }
    
    output.code=true;
    return (output);
  }
  
  
  checkArgSyntax(){
    //**** todo ****//
  }
  
  handleEvent (){
    //  handle slack doPOST events
  
    // extract relevant data from message body
    var workspace = this.teamid;
    var command = this.subtype;
    var channelid = this.channelid;
    var userid = this.userid;
    var username = this.username;
    var args = this.argsString; // todo: replace this with slack.args
    var response_url = this.response_url;
    var trigger_id = this.trigger_id;
    
    // process command field. 
    // note: Slack has a 3 second timeout on client end. This has not been an issue yet, but with database volume increase, function execution times may increase and lead to timeouts. 
    // note-continued: A fix would be to return an acknowledgement message to client directly without actually executing the function. 
    // note-continued: The function should be somehow queued for execution and par.response_url is passed as an extra argument which allows the slack acknowledgment message to be updated. 
    // note-continued : I have tried delayed function executes with time-delay triggers but that was not appropriate as time-delay triggers - upon creation - have a 1 min queue time before triggering. Too long.
    // note-continued : A workaround could be to queue commands with an automatic submission to a dedicated form (see https://stackoverflow.com/questions/54809366/how-to-send-delayed-response-slack-api-with-google-apps-script-webapp?rq=1). 
    // note-continued : The form responses must be linked to the spreadsheet. Then, the onFormSubmit installed trigger may catch the submissions and execute the relevant functions. This is faster than time-delayed triggers, but can still take several seconds. 
    // note-continued : For now I have avoided any delayed execution and optimised the function execution times to ensure that a return message arrives within the 3 second timeout window.
    if(command==='done_clarify'){
      done_process_modal(userid,this.args);
      return ContentService.createTextOutput(); // an empty HTTP 200 OK message is required for modal to close on slack client end.
    } else if (command == '/_volunteer'){
      return volunteer(args, channelid, userid, username);      
    } else if (command == '/_volunteer2'){
      return volunteer2(args, channelid, userid, username);      
    } else if (command == '/_assign'){
      return assign(args,channelid, userid);      
    } else if (command == '/_cancel') {
      return cancel(args, channelid, userid);
    } else if (command == '/_done') {
      return contentServerJsonReply(done_send_modal(args, channelid, userid, response_url, trigger_id));
    } else if (command == '/_list') {
      return list(channelid);
    }  else if (command == '/_listactive') {
      return listactive(channelid);
    } else if (command == '/_listall') {
      return listall(channelid);
    } else if (command == '/_listmine') {
      return listmine(channelid,userid);
    } else if (command == '/_listallmine') {
      return listallmine(channelid,userid);
    } else if (command == '/jb_v'){
      return volunteer(args, channelid, userid, username);      
    } else if (command == '/jb_c') {
      return cancel(args, channelid, userid);
    } else if (command == '/jb_d') {
      return contentServerJsonReply(done_send_modal(args, channelid, userid, response_url, trigger_id)); // clarify request by opening a modal in slack (with trigger_id) for user to fill
      // IB dev switch            
    } else if (command == '/ib_v'){            
      return volunteer(args, channelid, userid, username);                  
    } else if (command == '/ib_c') {            
      return cancel(args, channelid, userid);            
    } else if (command == '/ib_d') {            
      return contentServerJsonReply(done_send_modal(args, channelid, userid, response_url, trigger_id));            
      // Default
    } else {
      return ContentService.createTextOutput('error: Sorry, the `' + command + '` command is not currently supported.');
    }
  }
  
  
}
