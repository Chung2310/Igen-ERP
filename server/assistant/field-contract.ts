import type {AssistantField} from '../../src/shared/assistant-workflow';

/** Calendar semantics come from the declared wire format, never from a value
 * or a user's sentence. Names/codes and month-only periods stay text. */
export function normalizeAssistantFieldContract(field:AssistantField):AssistantField {
 const namedCalendarRange=field.source==='query'&&['from','to','startDate','endDate','rangeStart','rangeEnd','createdFrom','createdTo'].includes(field.apiKey||field.key)
  &&/ngày/iu.test(field.label)&&!/giờ|HH:mm|timestamp/iu.test(field.label);
 const calendar=field.type==='text'&&!field.reference&&!field.options&&!/(?:name|title|code|sku|identifier)$/i.test(field.apiKey||field.key)
  &&(namedCalendarRange||field.pattern==='^\\d{4}-\\d{2}-\\d{2}$'||/\bYYYY-MM-DD\b/.test(field.label)&&!/[T ]HH|HH:mm/.test(field.label));
 return calendar?{...field,type:'date'}:field;
}
