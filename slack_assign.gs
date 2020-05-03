function assign(args, channelid, userid) {
   
  // define moderators according to their user_id
  var globvar = globalVariables();
  var mod_userid = globvar['MOD_USERID'];
  
  
  // check that user calling /assign command is a moderator
  if(userid!=mod_userid){
       return ContentService.createTextOutput('error: The `assign` command is not available.');
  }
  
  // extract arguments
  var args = args.split(' ');
  var uniqueid = args[0];
  var re = new RegExp("<@(U[A-Z0-9]+)\\|?(.*)>"); // regexp match for user_id and user_name in mention string
  var user_re = re.exec(args[1]); // RegExp.exec returns array. First element is matched string, following elements are matched groupings.
  
  // check user_re argument
  if (user_re === null){
    return ContentService.createTextOutput('error: I did not recognise the user you specified. Please specify the user by their mention name. Example: `/assign 1000 <@' + mod_userid  + '>`.');
  }
  var userid_target = user_re[1];
  var username_target = user_re[2];
  if (userid_target == ''){
    return ContentService.createTextOutput('error: I did not recognise the user you specified. Please specify the user by their mention name. Example: `/assign 1000 <@' + mod_userid  + '>`.');
  }
  
  // run /volunteer command as userid_target
  return volunteer(uniqueid, channelid, userid_target, username_target);
}