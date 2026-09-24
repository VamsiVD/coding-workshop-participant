// Form draft for the three facility dialogs: values, per-field errors, a
// headline error and the saving flag. The building, floor and seat dialogs
// differ only in their fields, so the submit-and-show-errors cycle lives here.
import { useEffect, useRef, useState } from 'react';

// [CONCEPT: Custom hook] `source` is the record being edited (or null); the draft resets
// from `initial` each time the dialog opens or the record changes.
export default function useDraft(open, source, initial) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  // A server message with no matching field (e.g. a network failure).
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  // [CONCEPT: useRef] The newest starting values without making them an effect dependency;
  // callers build `initial` inline, so it is a new object on every render.
  const initialRef = useRef(initial);
  initialRef.current = initial;

  // [CONCEPT: useEffect] Reset when the dialog opens, not while it animates closed.
  useEffect(() => {
    if (!open) return;
    setForm(initialRef.current);
    setErrors({});
    setFormError('');
    setSaving(false);
  }, [open, source]);

  // [CONCEPT: Event handling] One setter per field; editing a field clears its error.
  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((errs) => (errs[key] ? { ...errs, [key]: undefined } : errs));
  };

  // Shared TextField props by field name.
  const field = (key) => ({
    value: form[key], onChange: (e) => set(key, e.target.value), error: !!errors[key], helperText: errors[key], fullWidth: true, size: 'small',
  });

  // [CONCEPT: Form submission] Validate locally first; only a clean form reaches `save`,
  // whose rejection (an ApiError) is spread back over the fields.
  const submit = (validate, save) => async (e) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await save(form);
    } catch (err) {
      const fields = err.fields ?? {};
      setErrors(fields);
      // The headline is shown unless a field on this form already explains the problem.
      setFormError(Object.keys(fields).some((k) => k in form) ? '' : err.message);
      setSaving(false);
    }
  };

  return { form, errors, formError, saving, set, field, submit };
}
