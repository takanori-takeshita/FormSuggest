(() => {
  const formElements = document.querySelectorAll("form input, form textarea, form select");
  const values = [];

  formElements.forEach(el => {
    const name = el.name || el.id || el.getAttribute("data-name");
    if (!name) return;

    let value;

    if (el.type === "checkbox") {
      value = el.checked ? "true" : "false";
    } else if (el.type === "radio") {
      if (!el.checked) return;
      value = el.value;
    } else {
      value = el.value;
    }

    values.push({ name, value });
  });

  chrome.runtime.sendMessage({ type: "FORM_DATA", payload: values });
})();
