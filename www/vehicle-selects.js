(() => {
  const otherValue = '__other__';
  const selectByField = new WeakMap();
  const modelRequests = new WeakMap();
  const modelCache = new Map();
  const currentYear = new Date().getFullYear();
  const makesUrl = 'https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/car?format=json';

  function dispatchFieldChange(field) {
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setFieldValue(field, value) {
    const controls = selectByField.get(field);
    if (!controls) {
      field.value = value;
      return;
    }

    const optionExists = [...controls.select.options].some((option) => option.value === value);
    if (optionExists && value !== otherValue) {
      controls.select.value = value;
      controls.custom.value = '';
      controls.custom.hidden = true;
      field.value = value;
      return;
    }

    controls.select.value = otherValue;
    controls.custom.value = value;
    controls.custom.hidden = false;
    field.value = value;
  }

  function addOption(select, value, label) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  function replaceOptions(select, prompt, options = []) {
    select.replaceChildren();
    addOption(select, '', prompt);
    options.forEach((option) => addOption(select, option.value, option.label));
    addOption(select, otherValue, 'Other / enter manually');
  }

  function enhanceField(field, kind, owner) {
    const select = document.createElement('select');
    select.id = `${field.id || `price-${field.name}`}-select`;
    select.setAttribute('aria-label', field.closest('label')?.childNodes[0]?.textContent.trim() || kind);
    selectByField.set(field, { select, custom: null, kind });

    const custom = document.createElement('input');
    custom.type = kind === 'year' ? 'number' : 'text';
    custom.className = 'vehicle-custom-input';
    custom.placeholder = `Enter ${kind}`;
    custom.setAttribute('aria-label', `Enter ${kind}`);
    custom.hidden = true;

    const controls = selectByField.get(field);
    controls.custom = custom;
    field.before(select, custom);
    field.type = 'hidden';

    if (kind === 'year') {
        replaceOptions(select, 'Select year', Array.from(
          { length: currentYear - 1978 },
        (_, index) => String(currentYear + 1 - index)
      ).map((year) => ({ value: year, label: year })));
    } else {
      replaceOptions(select, kind === 'make' ? 'Select make' : 'Select year and make first');
      if (kind === 'model') select.disabled = true;
    }

    select.addEventListener('change', () => {
      const isOther = select.value === otherValue;
      custom.hidden = !isOther;
      if (!isOther) {
        custom.value = '';
        field.value = select.value;
        dispatchFieldChange(field);
      } else {
        field.value = custom.value;
        custom.focus();
      }
      if (kind === 'year' || kind === 'make') refreshModels(owner);
    });

    custom.addEventListener('input', () => {
      field.value = custom.value.trim();
      dispatchFieldChange(field);
      if (kind === 'year' || kind === 'make') refreshModels(owner);
    });

    return controls;
  }

  function getField(form, name) {
    if (form.id === 'price-search-form') return form.elements.namedItem(name);
    return form.querySelector(`#vehicle-${name}`);
  }

  async function loadModels(year, make) {
    const cacheKey = `${year}|${make.toLowerCase()}`;
    if (!modelCache.has(cacheKey)) {
      const url = `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${encodeURIComponent(year)}?format=json`;
      modelCache.set(cacheKey, fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error('Vehicle model lookup failed.');
          return response.json();
        })
        .then((data) => [...new Set((data.Results || []).map((item) => item.Model_Name).filter(Boolean))]
          .sort((left, right) => left.localeCompare(right))));
    }
    return modelCache.get(cacheKey);
  }

  async function refreshModels(form) {
    if (!form) return;
    const yearField = getField(form, 'year');
    const makeField = getField(form, 'make');
    const modelField = getField(form, 'model');
    const modelControls = modelField && selectByField.get(modelField);
    if (!yearField || !makeField || !modelControls) return;

    const modelSelect = modelControls.select;
    const year = yearField.value.trim();
    const make = makeField.value.trim();
    const previousValue = modelField.value;
    const requestId = (modelRequests.get(modelSelect) || 0) + 1;
    modelRequests.set(modelSelect, requestId);

    if (!year || !make) {
      replaceOptions(modelSelect, 'Select year and make first');
      modelSelect.disabled = true;
      modelField.value = '';
      modelControls.custom.value = '';
      modelControls.custom.hidden = true;
      return;
    }

    replaceOptions(modelSelect, 'Loading models...');
    modelSelect.disabled = true;
    try {
      const models = await loadModels(year, make);
      if (modelRequests.get(modelSelect) !== requestId) return;
      replaceOptions(modelSelect, 'Select model', models.map((model) => ({ value: model, label: model })));
      modelSelect.disabled = false;
        if (models.includes(previousValue)) setFieldValue(modelField, previousValue);
        else clearFieldValue(modelField);
    } catch {
      if (modelRequests.get(modelSelect) !== requestId) return;
      replaceOptions(modelSelect, 'Models unavailable - enter manually');
      modelSelect.disabled = false;
      setFieldValue(modelField, previousValue);
    }

    function clearFieldValue(field) {
      const controls = selectByField.get(field);
      if (controls) {
        controls.select.value = '';
        controls.custom.value = '';
        controls.custom.hidden = true;
      }
      field.value = '';
    }
  }

  async function loadMakes() {
    try {
      const response = await fetch(makesUrl);
      if (!response.ok) throw new Error('Vehicle make lookup failed.');
      const data = await response.json();
      return [...new Set((data.Results || []).map((item) => item.MakeName).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right));
    } catch {
      return [];
    }
  }

  function createModelOptions(form) {
    const yearField = getField(form, 'year');
    const makeField = getField(form, 'make');
    yearField.addEventListener('input', () => refreshModels(form));
    yearField.addEventListener('change', () => refreshModels(form));
    makeField.addEventListener('input', () => refreshModels(form));
    makeField.addEventListener('change', () => refreshModels(form));
  }

  async function initialize() {
    const scanForm = document.querySelector('#drop-zone');
    const scanFields = ['year', 'make', 'model'].map((name) => document.querySelector(`#vehicle-${name}`));
    const searchForm = document.querySelector('#price-search-form');
    if (!scanForm || scanFields.some((field) => !field) || !searchForm) return;

    scanFields.forEach((field, index) => enhanceField(field, ['year', 'make', 'model'][index], scanForm));
    ['year', 'make', 'model'].forEach((name) => enhanceField(searchForm.elements.namedItem(name), name, searchForm));

    [scanForm, searchForm].forEach(createModelOptions);

    const pairs = ['year', 'make', 'model'].map((name) => ({
      source: getField(scanForm, name),
      target: getField(searchForm, name)
    }));
    function syncVehicleToSearch() {
      pairs.forEach(({ source, target }) => {
        if (!target.dataset.edited) setFieldValue(target, source.value);
      });
      refreshModels(searchForm);
    }
    pairs.forEach(({ source }) => {
      source.addEventListener('input', syncVehicleToSearch);
      source.addEventListener('change', syncVehicleToSearch);
    });
    pairs.forEach(({ target }) => {
      target.addEventListener('input', () => { target.dataset.edited = 'true'; });
    });

    const makes = await loadMakes();
    [scanForm, searchForm].forEach((form) => {
      const makeField = getField(form, 'make');
      const { select } = selectByField.get(makeField);
      replaceOptions(select, makes.length ? 'Select make' : 'Makes unavailable - enter manually', makes.map((make) => ({ value: make, label: make })));
      const existingMake = makeField.value;
      if (existingMake) setFieldValue(makeField, existingMake);
    });
    refreshModels(scanForm);
    refreshModels(searchForm);
  }

  window.whatPartVehicleFieldValue = (field) => field?.value?.trim() || '';
  initialize();
})();