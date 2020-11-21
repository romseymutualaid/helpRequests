// Controllers for unpacking and processing sheet event objects.
//
// Events are routed to a specific SheetEventController subclass.
// The SheetEventController subclass has a Command model behaviour
// and a User Notify behaviour that it calls synchronously.
//
// Sheet events currently supported:
// - google form submission events (asyncCommand-form or helpRequest-form)
// - time-based triggered events (asyncCommand-timed)
// - google sheet manual edit events (tracking_sheet channel/status columns)


/*** CONSTRUCTORS ***/

/**
 * Return the appropriate SheetEventController subclass instance 
 * based on the specified event object e.
 * For details on google apps script trigger and event types see:
 * https://developers.google.com/apps-script/guides/triggers/events 
 * https://developers.google.com/apps-script/reference/script/trigger
 * @param {*} e
 */
var createSheetEventClassInstance = function(e) {  
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
      return new TimedTriggerSheetEventController(e);
      break;
      
    case ScriptApp.EventType.ON_FORM_SUBMIT:
      return createFormSubmitSheetEventClassInstance(e);
      break;
      
    case ScriptApp.EventType.ON_EDIT:
      return createEditSheetEventClassInstance(e);
      break;
      
    default:
      return new IgnoreSheetEventController();
  }
}


/**
 * Return the appropriate SheetEvent subclass instance based on the 
 * specified event object e. Submethod for form submit events.
 * @param {*} e
 */
var createFormSubmitSheetEventClassInstance = function(e){
  
  var eventForm = JSON.parse(
    PropertiesService.getScriptProperties().getProperty('EVENT_FORM'));
  
  if (e.values.length === eventForm.values.length){
    // this is a submission of the command form
    return new CommandFormSubmitSheetEventController(e);
  } else{
    // this is a submission of the request form
    // process only if channel is specified
    var channelName = e.values[globalVariables()['FORMINDEX_CHANNEL']];
    if (channelName && channelName !== ''){
      return new RequestFormSubmitSheetEventController(e);
    } else{
      return new IgnoreSheetEventController();
    }
  }
}

/**
 * Return the appropriate SheetEvent subclass instance based on the 
 * specified event object e. Submethod for sheet edit events.
 * @param {*} e
 */
var createEditSheetEventClassInstance = function(e){

  if (e.source.getActiveSheet().getName() === 
      globalVariables()['TRACKING_SHEETNAME']){
    // this is an edit on the tracking sheet
    return new EditTrackingSheetEventController(e);
  } else{
    return new IgnoreSheetEventController();
  } 
}


/*** LOGIC ***/

class SheetEventController {
  constructor(e){
    // class template

    this.subtype=null; // describes the lower level type of event
    // (slash command name, interactive message subtype, ...).

    var args={
      channelid:null, // channel_id that event originates from
      userid:null, // user_id from whom the event originates
      username:null, // (optional) user_name associated to this.userid
      response_url:null, // POST url to provide delayed response to user
      trigger_id:null, // id to generate interactive messages in response to event
      uniqueid:null, // (optional) help request number
      mention:{str:null, userid:null, username:null}, // (optional) 
      // markdown-formatted mention name
      more:null // (optional) space for extra arguments
    };
    
    this.cmd = new VoidCommand(args); // Command class instance returned by 
    // createCommandClassInstance(args)
    
    this.SlackMessengerBehaviour = new VoidMessenger(this.cmd);
  }
  
  handle(){
    return this.cmd.execute();
  }
  
  notify(msg){
    this.SlackMessengerBehaviour.send(msg);
  }
}

class IgnoreSheetEventController extends SheetEventController {
}

class TimedTriggerSheetEventController extends SheetEventController {
  constructor(e){
    super();
    
    var [, args] = handleTriggered(e.triggerUid);
    
    this.cmd = createCommandClassInstance(args);
    
    this.SlackMessengerBehaviour = new SlackUserAsyncMessenger(this.cmd);
  }
}

class CommandFormSubmitSheetEventController extends SheetEventController {
  constructor(e){
    super();
    
    var [timestamp, , args_str] = e.values;
    var args = JSON.parse(args_str);
    
    this.cmd = createCommandClassInstance(args);
    
    this.SlackMessengerBehaviour = new SlackUserAsyncMessenger(this.cmd);
  }
}

class RequestFormSubmitSheetEventController extends SheetEventController {
  constructor(e){
    super();
    
    var globvar = globalVariables();
    
    var args = {};
    var row_response = e.range.rowStart; // submission row in response sheet
    // submission row in tracking sheet
    var rowindex = row_response + globvar['SHEET_ROW_OFFSET'];
    args.uniqueid = getUniqueIDbyRowNumber(
      rowindex, globvar['UNIQUEID_START_VAL'], globvar['UNIQUEID_START_ROWINDEX']);
    args.userid = globvar['MOD_USERID'];
    
    this.cmd = new PostRequestCommand(args);
  }
}

class EditTrackingSheetEventController extends SheetEventController {
  constructor(e){
    super();
    
    var globvar = globalVariables();
    
    var args = {};
    var rowindex = e.range.getRow(); // indexed at 1
    args.uniqueid = getUniqueIDbyRowNumber(
      rowindex, globvar['UNIQUEID_START_VAL'], globvar['UNIQUEID_START_ROWINDEX']);
    args.userid = globvar['MOD_USERID'];
    
    // specify this.cmd depdending on the type of edit
    var tracking_sheet_columns = globvar['SHEET_COL_ORDER'];
    var colindex = e.range.getColumn() -1; // indexed at 0
    if (tracking_sheet_columns[colindex]==='channel' && e.value!==undefined){
      // this is an edit to the channel column
      // (newValue!==undefined avoids capturing undo - i.e. Ctrl+Z - 
      // and blank cell events)
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
      return new IgnoreSheetEventController();
    }
  }
}