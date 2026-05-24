(function() {
  const WS_URL = 'ws://' + window.location.host;
  let ws = null;
  let eventQueue = [];

  function connect() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      eventQueue.forEach(e => ws.send(JSON.stringify(e)));
      eventQueue = [];
    };

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.type === 'reload') {
        window.location.reload();
      }
    };

    ws.onclose = () => {
      setTimeout(connect, 1000);
    };
  }

  function sendEvent(event) {
    event.timestamp = Date.now();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    } else {
      eventQueue.push(event);
    }
  }

  function collectFields(root) {
    const fields = {};
    root.querySelectorAll('input, textarea, select').forEach((field) => {
      const key = field.name || field.id;
      if (!key) return;
      if (field.type === 'checkbox') {
        fields[key] = field.checked;
      } else if (field.type === 'radio') {
        if (field.checked) fields[key] = field.value;
      } else {
        fields[key] = field.value;
      }
    });
    return fields;
  }

  // Capture clicks on choice elements
  document.addEventListener('click', (e) => {
    const submitControl = e.target.closest('[data-submit], button, input[type="submit"]');
    const isSubmitControl = submitControl && (
      submitControl.matches('[data-submit], input[type="submit"]') ||
      (submitControl.tagName === 'BUTTON' && (!submitControl.hasAttribute('type') || submitControl.type === 'submit'))
    );
    if (isSubmitControl) return;
    const target = e.target.closest('[data-choice]');
    if (!target) return;

    sendEvent({
      type: 'click',
      text: target.textContent.trim(),
      choice: target.dataset.choice,
      id: target.id || null
    });

    // Update indicator bar (defer so toggleSelect runs first)
    setTimeout(() => {
      const indicator = document.getElementById('indicator-text');
      if (!indicator) return;
      const container = target.closest('.options') || target.closest('.cards');
      const selected = container ? container.querySelectorAll('.selected') : [];
      if (selected.length === 0) {
        indicator.textContent = 'Click an option above, then return to the terminal';
      } else if (selected.length === 1) {
        const label = selected[0].querySelector('h3, .content h3, .card-body h3')?.textContent?.trim() || selected[0].dataset.choice;
        indicator.innerHTML = '<span class="selected-text">' + label + ' selected</span> — return to terminal to continue';
      } else {
        indicator.innerHTML = '<span class="selected-text">' + selected.length + ' selected</span> — return to terminal to continue';
      }
    }, 0);
  });

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-submit]');
    if (!trigger) return;

    const root = trigger.closest('[data-brainstorm-form]') || trigger.closest('.option, .card, .section') || document;
    sendEvent({
      type: 'submit',
      text: trigger.textContent.trim(),
      choice: trigger.dataset.choice || root.dataset.choice || null,
      value: trigger.dataset.value || null,
      fields: collectFields(root),
      id: trigger.id || null
    });
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-brainstorm-form]');
    if (!form) return;
    e.preventDefault();

    sendEvent({
      type: 'submit',
      text: form.textContent.trim(),
      choice: form.dataset.choice || null,
      value: form.dataset.value || null,
      fields: collectFields(form),
      id: form.id || null
    });
  });

  // Frame UI: selection tracking
  window.selectedChoice = null;

  window.toggleSelect = function(el) {
    const container = el.closest('.options') || el.closest('.cards');
    const multi = container && container.dataset.multiselect !== undefined;
    if (container && !multi) {
      container.querySelectorAll('.option, .card').forEach(o => o.classList.remove('selected'));
    }
    if (multi) {
      el.classList.toggle('selected');
    } else {
      el.classList.add('selected');
    }
    window.selectedChoice = el.dataset.choice;
  };

  // Expose API for explicit use
  window.brainstorm = {
    send: sendEvent,
    choice: (value, metadata = {}) => sendEvent({ type: 'choice', value, ...metadata }),
    submit: (fields = {}, metadata = {}) => sendEvent({ type: 'submit', fields, ...metadata })
  };

  connect();
})();
