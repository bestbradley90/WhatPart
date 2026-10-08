(() => {
  const footer = document.querySelector('footer');
  if (!footer || document.querySelector('#price-hunt')) return;

  const section = document.createElement('section');
  section.id = 'price-hunt';
  section.className = 'price-hunt';
  section.setAttribute('aria-labelledby', 'price-hunt-title');
  section.innerHTML = `
    <div class="price-hunt-heading">
      <p class="eyebrow">Price hunt / 01</p>
      <h2 id="price-hunt-title">Find the part. Chase the price.</h2>
      <p>Search seller listings for your exact ride, then compare fitment, condition, shipping, and total cost.</p>
    </div>
    <form class="price-search-form" id="price-search-form">
      <label class="price-part-field">Part you need
        <input name="part" type="search" placeholder="Brake pads, alternator, wheel..." required>
      </label>
      <fieldset class="price-source-choice">
        <legend>Part type</legend>
        <label><input type="radio" name="part-type" value="aftermarket" checked> Aftermarket</label>
        <label><input type="radio" name="part-type" value="OEM"> OEM</label>
      </fieldset>
      <div class="price-vehicle-fields" aria-label="Vehicle details for parts search">
        <label>Model year<input name="year" type="number" min="1880" max="2100" placeholder="2020"></label>
        <label>Make<input name="make" type="text" placeholder="Toyota" autocomplete="off"></label>
        <label>Model<input name="model" type="text" placeholder="Tacoma" autocomplete="off"></label>
        <label>Engine<input name="engine" type="text" placeholder="3.5L V6" autocomplete="off"></label>
        <label>Trim / drivetrain<input name="trim" type="text" placeholder="TRD 4WD" autocomplete="off"></label>
      </div>
      <button class="price-search-submit" type="submit">Compare seller prices <span aria-hidden="true">↗</span></button>
    </form>
    <p class="price-search-note">Seller searches open in new tabs. Prices and fitment are not aggregated here; confirm the exact part and total cost with each seller.</p>
    <div class="price-search-results" id="price-search-results" aria-live="polite" hidden>
      <div class="price-results-heading"><h3>Compare listings</h3><span id="price-search-summary"></span></div>
      <div class="seller-links">
        <a data-seller="shopping" target="_blank" rel="noopener noreferrer"><span>Google Shopping</span><span class="seller-action">Browse listings ↗</span></a>
        <a data-seller="ebay" target="_blank" rel="noopener noreferrer"><span>eBay</span><span class="seller-action">Lowest price first ↗</span></a>
        <a data-seller="amazon" target="_blank" rel="noopener noreferrer"><span>Amazon</span><span class="seller-action">Browse listings ↗</span></a>
        <a data-seller="rockauto" target="_blank" rel="noopener noreferrer"><span>RockAuto</span><span class="seller-action">Browse catalog ↗</span></a>
      </div>
    </div>`;

  footer.before(section);

  const searchForm = section.querySelector('#price-search-form');
  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(searchForm);
    const part = String(values.get('part') || '').trim();
    if (!part) return;

    const vehicle = ['year', 'make', 'model', 'engine', 'trim']
      .map((name) => String(values.get(name) || '').trim())
      .filter(Boolean)
      .join(' ');
    const type = String(values.get('part-type') || 'aftermarket');
    const query = [type === 'OEM' ? 'OEM' : 'aftermarket', part, vehicle].filter(Boolean).join(' ');
    const encodedQuery = encodeURIComponent(query);
    const sellerUrls = {
      shopping: `https://www.google.com/search?tbm=shop&q=${encodedQuery}`,
      ebay: `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}&_sop=15`,
      amazon: `https://www.amazon.com/s?k=${encodedQuery}`,
      rockauto: `https://www.rockauto.com/en/catalog/?q=${encodedQuery}`
    };

    Object.entries(sellerUrls).forEach(([seller, url]) => {
      section.querySelector(`[data-seller="${seller}"]`).href = url;
    });
    section.querySelector('#price-search-summary').textContent = [part, vehicle].filter(Boolean).join(' / ');
    section.querySelector('#price-search-results').hidden = false;
  });
})();