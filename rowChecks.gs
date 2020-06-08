// Validation logic for ConcreteCommands (see commands.gs)

var checkUniqueIDexists = function(row, args) {
  var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];
  
  if (isVarInArray(row.uniqueid,["",null,undefined])){
    throw new Error(uniqueIDdoesNotExistMessage(args));
  }
}

var checkUniqueIDconsistency = function(row, args) {
  var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];
  
  if (row.uniqueid !== args.uniqueid){
    throw new Error(uniqueIDlookupIsCorruptedMessage(row,args));
  }
}

var checkChannelIDconsistency = function(row, args) {
  var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];
  var mod_userid = globalVariables()['MOD_USERID'];
  
  if (args.userid !== mod_userid && row.channelid !== args.channelid){
    throw new Error(wrongChannelMessage(row));
  }
}

var checkRowIsVolunteerable = function(row, args){
  var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];
  
  // the request is open and unassigned
  if (row.requestStatus === 'Sent'){
    return;
    // or request is assigned ...
  } else {
    // ... to another user
    if (row.slackVolunteerID !== args.userid){
      throw new Error(requestAssignedToOtherUserMessage(row));
    }
    // ... to current user ...
    else{
      // ... and open
      if(isVarInArray(row.requestStatus,['Assigned','Ongoing'])){
        throw new Error(volunteerSuccessMessage(row,false));
      }
      // ... and closed
      else{
        throw new Error(requestClosedVolunteerMessage(row));
      }
    }
  }
}


var checkRowIsCancellable = function(row, args) {
  var mod_userid = globalVariables()['MOD_USERID'];
  
  // the request is open, and assigned to user or user is moderator
  if (isVarInArray(row.requestStatus,['Assigned','Ongoing','ToClose?','Re-open']) && 
      isVarInArray(args.userid,[row.slackVolunteerID, mod_userid])){
      return;
}
  else{
    // request is open and unassigned
    if (isVarInArray(row.requestStatus,['Sent','FailSend'])) {
      throw new Error(requestUnassignedMessage(row));
    } 
    // request is open and assigned to another user
    else if(row.slackVolunteerID !== args.userid){
      throw new Error(requestAssignedToOtherUserMessage(row));
        }
     // request is closed
     else if (isVarInArray(row.requestStatus,['Escalated','Signposted','Closed'])) {
       throw new Error(requestClosedCancelMessage(row));
     } 
      // other
      else {
        throw new Error(requestStatusNotRecognisedMessage(row));
      }
  }
}


var checkRowAcceptsDone = function(row, args){
  var mod_userid = globalVariables()['MOD_USERID'];
  
  // the request is not permanently closed, and assigned to user or user is moderator
  if (isVarInArray(row.requestStatus,['Assigned','Ongoing','ToClose?','Closed']) && 
      isVarInArray(args.userid,[row.slackVolunteerID, mod_userid])){
      return;
}
  else{
    // request is open and unassigned
    if (isVarInArray(row.requestStatus,['Sent','FailSend','Re-open'])) {
      throw new Error(requestUnassignedMessage(row));
    } 
    // request is open and assigned to another user
    else if(row.slackVolunteerID !== args.userid){
      throw new Error(requestAssignedToOtherUserMessage(row));
        }
     // request is permanently closed
     else if (isVarInArray(row.requestStatus,['Escalated','Signposted'])) {
       throw new Error(requestClosedDoneMessage(row));
     } 
      // other
      else {
        throw new Error(requestStatusNotRecognisedMessage(row));
      }
  }
}