(function() {
  const VC_TOKEN = window.__VISUAL_COMPANION_TOKEN || '';
  const WS_URL = 'ws://' + window.location.host + '/?token=' + encodeURIComponent(VC_TOKEN);
  let ws = null;
  let eventQueue = [];
  let fallbackQueue = [];
  let fallbackTimer = null;
  let logQueue = [];
  let logTimer = null;

  function makeEventId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
  }

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

  function flushFallbackQueue() {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    if (fallbackQueue.length === 0) return;

    const batch = fallbackQueue.splice(0, fallbackQueue.length);
    fetch('/__visual_companion_event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Visual-Companion-Token': VC_TOKEN
      },
      body: JSON.stringify(batch.length === 1 ? batch[0] : batch),
      keepalive: true
    }).catch(() => {
      fallbackQueue = batch.concat(fallbackQueue).slice(-100);
      fallbackTimer = setTimeout(flushFallbackQueue, 1000);
    });
  }

  function flushLogQueue() {
    if (logTimer) {
      clearTimeout(logTimer);
      logTimer = null;
    }
    if (logQueue.length === 0) return;

    const batch = logQueue.splice(0, logQueue.length);
    fetch('/__visual_companion_log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Visual-Companion-Token': VC_TOKEN
      },
      body: JSON.stringify(batch.length === 1 ? batch[0] : batch),
      keepalive: true
    }).catch(() => {
      logQueue = batch.concat(logQueue).slice(-100);
      logTimer = setTimeout(flushLogQueue, 1000);
    });
  }

  function logDiagnostic(action, detail = {}) {
    logQueue.push({
      source: 'browser-helper',
      action,
      timestamp: Date.now(),
      page: window.location.pathname,
      ...detail
    });
    logQueue = logQueue.slice(-100);
    if (!logTimer) logTimer = setTimeout(flushLogQueue, 0);
  }

  function scheduleFallback(event) {
    if (event.type === 'heartbeat') return;
    fallbackQueue.push(event);
    fallbackQueue = fallbackQueue.slice(-100);
    if (!fallbackTimer) fallbackTimer = setTimeout(flushFallbackQueue, 0);
  }

  function sendEvent(event) {
    event.eventId = event.eventId || makeEventId();
    event.timestamp = Date.now();
    if (event.type !== 'heartbeat') {
      logDiagnostic('send-event', {
        eventId: event.eventId,
        type: event.type || null,
        choice: event.choice || null,
        value: event.value || null,
        wsState: ws ? ws.readyState : null
      });
    }
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    } else {
      eventQueue.push(event);
    }
    scheduleFallback(event);
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

  function isMultiContainer(container) {
    return container && container.dataset.multiselect !== undefined;
  }

  function getMultiContainers() {
    return Array.from(document.querySelectorAll('.options[data-multiselect], .cards[data-multiselect]'));
  }

  function extractLabel(el) {
    const heading = el.querySelector('h3, .content h3, .card-body h3');
    return (heading?.textContent || el.textContent || '').trim();
  }

  function collectSelections(container) {
    return Array.from(container.querySelectorAll('.selected')).map((el) => ({
      choice: el.dataset.choice,
      text: extractLabel(el)
    }));
  }

  function updateMultiUI() {
    const containers = getMultiContainers();
    const submitBtn = document.getElementById('multi-submit');
    const indicator = document.getElementById('indicator-text');
    if (containers.length === 0) {
      if (submitBtn) submitBtn.hidden = true;
      return;
    }
    let total = 0;
    containers.forEach((c) => { total += c.querySelectorAll('.selected').length; });
    if (submitBtn) {
      submitBtn.hidden = false;
      submitBtn.disabled = total === 0;
      submitBtn.textContent = total === 0 ? 'Submit' : 'Submit (' + total + ')';
    }
    if (indicator) {
      if (total === 0) {
        indicator.textContent = 'Select one or more, then click Submit';
      } else {
        indicator.innerHTML = '<span class="selected-text">' + total + ' selected</span> - click Submit when ready';
      }
    }
  }

  function submitMultiSelection() {
    const containers = getMultiContainers();
    const selections = [];
    containers.forEach((c) => {
      collectSelections(c).forEach((s) => selections.push(s));
    });
    if (selections.length === 0) return;

    const choices = selections.map((s) => s.choice);
    const texts = selections.map((s) => s.text);
    sendEvent({
      type: 'submit',
      choices,
      texts,
      choice: choices.length === 1 ? choices[0] : null,
      text: texts.join(', '),
      count: choices.length
    });

    const submitBtn = document.getElementById('multi-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitted (' + choices.length + ')';
    }
    const indicator = document.getElementById('indicator-text');
    if (indicator) {
      indicator.innerHTML = '<span class="selected-text">' + choices.length + ' submitted</span> - return to terminal to continue';
    }
  }

  function initMultiSelect() {
    const submitBtn = document.getElementById('multi-submit');
    if (submitBtn && !submitBtn.dataset.bound) {
      submitBtn.dataset.bound = '1';
      submitBtn.addEventListener('click', submitMultiSelection);
    }
    updateMultiUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMultiSelect);
  } else {
    initMultiSelect();
  }

  // Capture clicks on choice elements
  document.addEventListener('click', (e) => {
    const submitControl = e.target.closest('[data-submit], input[type="submit"], button[type="submit"]');
    const isSubmitControl = submitControl && (
      submitControl.matches('[data-submit], input[type="submit"]') ||
      (submitControl.tagName === 'BUTTON' && submitControl.type === 'submit')
    );
    if (isSubmitControl) return;

    const target = e.target.closest('[data-choice]');
    if (!target) return;

    const container = target.closest('.options, .cards');
    const multi = isMultiContainer(container);

    if (!target.hasAttribute('onclick') && typeof window.toggleSelect === 'function') {
      window.toggleSelect(target);
    }

    if (multi) {
      // Multi-select: do not send per-click events. Wait for explicit submit.
      updateMultiUI();
      return;
    }

    sendEvent({
      type: 'click',
      text: target.textContent.trim(),
      choice: target.dataset.choice,
      id: target.id || null
    });

    // Single-select indicator update (defer so toggleSelect runs first)
    setTimeout(() => {
      const indicator = document.getElementById('indicator-text');
      if (!indicator) return;
      const c = target.closest('.options') || target.closest('.cards');
      const selected = c ? c.querySelectorAll('.selected') : [];
      if (selected.length === 0) {
        indicator.textContent = 'Click an option above, then return to the terminal';
      } else if (selected.length === 1) {
        const label = extractLabel(selected[0]) || selected[0].dataset.choice;
        indicator.innerHTML = '<span class="selected-text">' + label + ' selected</span> - return to terminal to continue';
      } else {
        indicator.innerHTML = '<span class="selected-text">' + selected.length + ' selected</span> - return to terminal to continue';
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

  setInterval(() => {
    sendEvent({ type: 'heartbeat' });
  }, 25 * 1000);
})();
