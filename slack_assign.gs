function assign(args) {

  // define moderators according to their user_id
  var globvar = globalVariables();
  var mod_userid = globvar['MOD_USERID'];

  // check that user calling /assign command is a moderator
  if(args.userid!=mod_userid){
       return textToJsonBlocks('error: The `assign` command is not available.');
  }

  // run /volunteer command as userid_target
  args.userid = args.mention.userid;
  args.username = args.mention.username;
  return volunteer(args);
}