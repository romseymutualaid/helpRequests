/**
 * Return a trigger's event type based on its Uid.
 * See https://developers.google.com/apps-script/reference/script/event-type
 * @param {int} triggerUid The trigger ID
 */
var getTriggerEventType = function(triggerUid) {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggerUid === triggers[i].getUniqueId()) {
      var event_type = triggers[i].getEventType();
      break;
    }
  }
  return event_type;
}