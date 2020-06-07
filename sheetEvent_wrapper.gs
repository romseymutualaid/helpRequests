/**
 *  Return the appropriate SheetEvent subclass instance based on the specified event object e.
 *  For details on google apps script trigger and event types see:
 *  https://developers.google.com/apps-script/guides/triggers/events 
 *  https://developers.google.com/apps-script/reference/script/trigger
 * @param {*} e
 */
var createSheetEventClassInstance = function(e) {
  // currently, this function handles:
  // - form submission events (asyncCommand form or helpRequest form)
  // - time-based triggered events (asyncCommand alternative solution)
  // - tracking sheet manual edit events (to channel or status fields)
  
  // get trigger EventType
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (e.triggerUid === triggers[i].getUniqueId()) {
      var event_type = triggers[i].getEventType();
      break;
    }    
  }
  
  // instantiate the appropriate SheetEvent subclass
  switch (event_type) {
    case ScriptApp.EventType.CLOCK:
      return new TimedTriggerSheetEventWrapper(e);
      break;
      
    case ScriptApp.EventType.ON_FORM_SUBMIT:
      return createFormSubmitSheetEventClassInstance(e);
      break;
      
    case ScriptApp.EventType.ON_EDIT:
      return createEditSheetEventClassInstance(e);
      break;
      
    default:
      return new IgnoreSheetEventWrapper();
  }
}


/**
 *  Return the appropriate SheetEvent subclass instance based on the specified event object e.
 *  Submethod for form submit events.
 * @param {*} e
 */
var createFormSubmitSheetEventClassInstance = function(e){
  
  var eventForm = JSON.parse(PropertiesService.getScriptProperties().getProperty('EVENT_FORM'));
  
  if (e.values.length === eventForm.values.length){
    // this is a submission of the command form
    return new CommandFormSubmitSheetEventWrapper(e);
  } else{
    // this is a submission of the request form
    // process only if channel is specified
    var channelName = e.values[globalVariables()['FORMINDEX_CHANNEL']];
    if (channelName && channelName !== ''){
      return new RequestFormSubmitSheetEventWrapper(e);
    } else{
      return new IgnoreSheetEventWrapper();
    }
  }
}

/**
 *  Return the appropriate SheetEvent subclass instance based on the specified event object e.
 *  Submethod for sheet edit events.
 * @param {*} e
 */
var createEditSheetEventClassInstance = function(e){

  if (e.source.getActiveSheet().getName() === globalVariables()['TRACKING_SHEETNAME']){
    // this is an edit on the tracking sheet
    return new EditTrackingSheetEventWrapper(e);
  } else{
    return new IgnoreSheetEventWrapper();
  } 
}


class SheetEventWrapper {
  constructor(){
    // class template

    this.subtype=null; // describes the lower level type of event (slash command name, interactive message subtype, ...)

    var args={
      channelid:null, // channel_id that event originates from
      userid:null, // user_id from whom the event originates
      username:null, // (optional) user_name associated to this.userid
      response_url:null, // POST url to provide delayed response to user
      trigger_id:null, // needed to generate interactive messages in response to event
      uniqueid:null, // (optional) help request number
      mention:{str:null, userid:null, username:null}, // (optional) markdown-formatted mention name
      more:null // (optional) space for extra arguments
    };
    
    this.cmd = new VoidCommand(args); // Command class instance returned by createCommandClassInstance(this.subtype, args)
    
    this.SlackMessengerBehaviour = new VoidMessenger(this.cmd);
  }
  
  handle(){
    return this.cmd.execute();
  }
  
  notify(msg){
    this.SlackMessengerBehaviour.send(msg);
  }
}

class IgnoreSheetEventWrapper extends SheetEventWrapper {
}

class TimedTriggerSheetEventWrapper extends SheetEventWrapper {
  constructor(e){
    super();
    
    var [cmdName, args] = handleTriggered(e.triggerUid);
    
    this.subtype = cmdName;
    this.cmd = createCommandClassInstance(this.subtype, args);
    
    this.SlackMessengerBehaviour = new SlackUserAsyncMessenger(this.cmd);
  }
}

class CommandFormSubmitSheetEventWrapper extends SheetEventWrapper {
  constructor(e){
    super();
    
    var [timestamp, cmdName, args_str] = e.values;
    var args = JSON.parse(args_str);
    
    this.subtype = cmdName;
    this.cmd = createCommandClassInstance(this.subtype, args);
    
    this.SlackMessengerBehaviour = new SlackUserAsyncMessenger(this.cmd);
  }
}

class RequestFormSubmitSheetEventWrapper extends SheetEventWrapper {
  constructor(e){
    super();
    
    var globvar = globalVariables();
    
    var args = {};
    var row_response = e.range.rowStart; // row where submission is in response sheet
    var rowindex = row_response + globvar['SHEET_ROW_OFFSET']; // row where submission is in tracking sheet, taking any potential row offset between sheets into account.
    args.uniqueid = getUniqueIDbyRowNumber(rowindex, globvar['UNIQUEID_START_VAL'], globvar['UNIQUEID_START_ROWINDEX']);
    args.userid = globvar['MOD_USERID'];
    
    this.cmd = new PostRequestCommand(args);
  }
}

class EditTrackingSheetEventWrapper extends SheetEventWrapper {
  constructor(e){
    super();
    
    var globvar = globalVariables();
    
    var args = {};
    var rowindex = e.range.getRow(); // indexed at 1
    args.uniqueid = getUniqueIDbyRowNumber(rowindex, globvar['UNIQUEID_START_VAL'], globvar['UNIQUEID_START_ROWINDEX']);
    args.userid = globvar['MOD_USERID'];
    
    // specify this.cmd depdending on the type of edit
    var tracking_sheet_columns = globvar['SHEET_COL_ORDER'];
    var colindex = e.range.getColumn() -1; // indexed at 0
    if (tracking_sheet_columns[colindex]==='channel' && e.value!==undefined){
      // this is an edit to the channel column (newValue!==undefined avoids capturing undo - i.e. Ctrl+Z - and blank cell events)
      this.cmd = new PostRequestCommand(args);
    } 
    else if (tracking_sheet_columns[colindex]==='requestStatus'){
      // this is an edit to the status column
      if(e.value === 'Re-open'){
        // trigger the cancel command as a super-user
        this.cmd = new CancelCommand(args);
      } 
      else {
        // for other status changes, just log the change
        args.more = e.value;
        this.cmd = new StatusLogCommand(args);
      }
    } 
    else{
      return new IgnoreSheetEventWrapper();
    }
  }
}