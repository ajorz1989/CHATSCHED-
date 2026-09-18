/**
 * Redirects the browser to PayFast by building and auto-submitting a hidden
 * form. PayFast expects a POST with these fields, not a GET query string.
 */
export function redirectToPayfast(actionUrl: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = actionUrl;

  for (const [key, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}
