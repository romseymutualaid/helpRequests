function processAsyncWithFormTrigger(functionName, args) {
  // Submit request to event form, to allow a delayed response
  
  // construct post request
  var eventForm = JSON.parse(PropertiesService.getScriptProperties().getProperty('EVENT_FORM'));
  var options = {
    method:'post',
    payload:{
      [eventForm.entry_id.fctName]:functionName,
      [eventForm.entry_id.args]:JSON.stringify(args)
    }
  };
  
  // Post request submission to form. The return value of .getContextText() does not appear to be informative of success of submission.
  UrlFetchApp.fetch(eventForm.url, options).getContentText(); 
}


function handleEventFormSubmission(values){
  // handle the submissions that originate specifically from the eventForm
  
  // extract functionName, args and response_url
  var [timestamp, functionName, args_str] = values;
  var args = JSON.parse(args_str);
  
  // call processAndPostResults
  processAndPostResults(functionName, args);
}

