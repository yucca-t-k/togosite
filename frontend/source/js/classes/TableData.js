import App from "./App";
import DefaultEventEmitter from "./DefaultEventEmitter";
import ConditionBuilder from "./ConditionBuilder";
import Records from "./Records";
import * as event from '../events';
import ConditionsController from "./ConditionsController";

const LIMIT = 100;

export default class TableData {

  #condition;
  #serializedHeader;
  #queryIds;
  #rows;
  #abortController;
  #isAutoLoad;
  #isLoading;
  #isCompleted;
  #startTime;
  #downloadReserveButton;
  #ROOT;
  #STATUS;
  #INDICATOR_TEXT_AMOUNT;
  #INDICATOR_TEXT_TIME;
  #INDICATOR_BAR;
  #BUTTON_PREPARE_DATA;
  #BUTTON_DOWNLOAD_JSON;
  #BUTTON_DOWNLOAD_TSV;
  

  constructor(condition, elm) {
    console.log(condition)

    this.#isAutoLoad = false;
    this.#isCompleted = false;
    this.#condition = condition;
    this.#serializedHeader = [
      ...condition.attributes.map(property => property.query.propertyId),
      ...condition.properties.map(property => property.query.propertyId)
    ];
    this.#queryIds = [];
    this.#rows = [];

    // view
    elm.classList.add('table-data-controller-view');
    elm.dataset.status = 'load ids';

    elm.innerHTML = `
    <div class="close-button-view"></div>
    <div class="conditions">
      <div class="condiiton">
        <p title="${condition.togoKey}">${Records.getLabelFromTogoKey(condition.togoKey)}</p>
      </div>
      ${condition.attributes.map(property => `<div class="condiiton _subject-background-color" data-subject-id="${property.subject.subjectId}">
        <p title="${property.property.label}">${property.property.label}</p>
      </div>`).join('')}
      ${condition.properties.map(property => `<div class="condiiton _subject-color" data-subject-id="${property.subject.subjectId}">
        <p title="${property.property.label}">${property.subCategory ? property.subCategory.label : property.property.label}</p>
      </div>`).join('')}
    </div>
    <div class="status">
      <p>Getting id list</p>
    </div>
    <div class="indicator">
      <div class="text">
        <div class="amount-of-data"></div>
        <div class="remaining-time"></div>
      </div>
      <div class="progress">
        <div class="bar"></div>
      </div>
    </div>
    <div class="controller">
      <div class="button" data-button="download-json">
        <a class="json">
          <span class="material-icons-outlined">download json</span>
          <span class="label">JSON</span>
        </a>
      </div>
      <div class="button" data-button="download-tsv">
        <a class="tsv">
          <span class="material-icons-outlined">download tsv</span>
          <span class="label">TSV</span>
        </a>
      </div>
      <div class="button none" data-button="prepare-data">
        <span class="material-icons-outlined">autorenew</span>
        <span class="label">Pause</span>
      </div>
      <div class="button" data-button="restore">
        <span class="material-icons-outlined">edit</span>
        <span class="label">Edit</span>
      </div>
    </div>
    `;

    // reference　
    this.#ROOT = elm;
    this.#STATUS = elm.querySelector(':scope > .status > p');
    const INDICATOR = elm.querySelector(':scope > .indicator');
    this.#INDICATOR_TEXT_AMOUNT = INDICATOR.querySelector(':scope > .text > .amount-of-data');
    this.#INDICATOR_TEXT_TIME = INDICATOR.querySelector(':scope > .text > .remaining-time');
    this.#INDICATOR_BAR = INDICATOR.querySelector(':scope > .progress > .bar');
    const BUTTONS = [...elm.querySelectorAll(':scope > .controller > .button')];
    this.#BUTTON_PREPARE_DATA = BUTTONS.find(button => button.dataset.button === 'prepare-data');
    this.#BUTTON_DOWNLOAD_JSON = BUTTONS.find(button => button.dataset.button === 'download-json');
    this.#BUTTON_DOWNLOAD_TSV = BUTTONS.find(button => button.dataset.button === 'download-tsv');

    // events
    elm.addEventListener('click', () => {
      if (elm.classList.contains('-current')) return;
      this.select();
    });
    // prepare data
    [this.#BUTTON_DOWNLOAD_JSON, this.#BUTTON_DOWNLOAD_TSV].forEach(button => {
      button.addEventListener('click', e => {
        e.stopPropagation();
        if (this.#isAutoLoad === false && this.#ROOT.dataset.status !== 'complete') {
          this.#autoLoad();
          this.#changeButtons();
          this.#downloadReserveButton = button;
        } else {
          this.#isAutoLoad = false;
        }
      })
    })
    
    this.#BUTTON_PREPARE_DATA.addEventListener('click', e => {
      e.stopPropagation();
      if (this.#isAutoLoad === false && this.#ROOT.dataset.status !== 'complete') {
        this.#autoLoad();
        this.#BUTTON_PREPARE_DATA.classList.add('-rotating');
        this.#BUTTON_PREPARE_DATA.querySelector(':scope > .label').innerHTML = 'Pause';
      } else {
        this.#isAutoLoad = false;
        this.#BUTTON_PREPARE_DATA.classList.remove('-rotating');
        this.#BUTTON_PREPARE_DATA.querySelector(':scope > .label').innerHTML = 'Resume';
      }
    });
    // delete
    this.#ROOT.querySelector(':scope > .close-button-view').addEventListener('click', e => {
      e.stopPropagation();
      const customEvent = new CustomEvent(event.deleteTableData, {detail: this});
      DefaultEventEmitter.dispatchEvent(customEvent);
      // abort fetch
      this.#abortController.abort();
      // delete element
      this.#ROOT.parentNode.removeChild(this.#ROOT);
      // transition
      document.querySelector('body').dataset.display = 'properties';
    });
    // restore
    BUTTONS.find(button => button.dataset.button === 'restore').addEventListener('click', e => {
      e.stopPropagation();
      // property (attribute)
      console.log(this.#condition)
      ConditionBuilder.setProperties(this.#condition.properties.map(property => {
        return {
          subject: property.subject,
          property: property.property
        }
      }));
      // attribute (classification/distribution)
      Records.properties.forEach(property => {
        const attribute = this.#condition.attributes.find(attribute => attribute.property.propertyId === property.propertyId);
        let subject, values = [];
        if (attribute) {
          subject = attribute.subject;
          values = attribute.query.categoryIds.map(categoryId => {
            return {
              categoryId: categoryId,
              label: Records.getValue(attribute.query.propertyId, categoryId).label,
              ancestors: []
            }
          });
        } else {
          subject = Records.getSubject(property.subjectId);
        }
        ConditionBuilder.setPropertyValues({subject, property, values});
      });
    });
    this.select();
    this.#getQueryIds();
  }
  

  /* private methods */

  #getQueryIds() {
    // reset
    this.#abortController = new AbortController();
    this.#ROOT.classList.add('-fetching');
    fetch(
      `${App.aggregatePrimaryKeys}?togoKey=${this.#condition.togoKey}&properties=${encodeURIComponent(JSON.stringify(this.#condition.attributes.map(property => property.query)))}${ConditionBuilder.userIds ? `&inputIds=${encodeURIComponent(JSON.stringify(ConditionBuilder.userIds.split(',')))}` : ''}`,
      {
        signal: this.#abortController.signal
      })
      .catch(error => {
        throw Error(error);
      })
      .then(responce => {
        if (responce.ok) {
          return responce
        };
        this.#STATUS.classList.add('-error');
        this.#STATUS.textContent = `${responce.status} (${responce.statusText})`;
        throw Error(responce);
      })
      .then(responce => responce.json())
      .then(queryIds => {
        console.log(queryIds)
        this.#queryIds = queryIds;
        // display
        this.#ROOT.dataset.status = 'load rows';
        this.#STATUS.textContent = '';
        this.#INDICATOR_TEXT_AMOUNT.innerHTML = `${this.offset.toLocaleString()} / ${this.#queryIds.length.toLocaleString()}`;
        this.#startTime = Date.now();
        this.#getProperties();
      })
      .catch(error => {
        // TODO:
        console.error(error)
        const customEvent = new CustomEvent(event.failedFetchTableDataIds, {detail: this});
        DefaultEventEmitter.dispatchEvent(customEvent);
      })
      .finally(() => {
        this.#ROOT.classList.remove('-fetching');
      });
  }

  #getProperties() {
    if (this.#isLoading) return;
    this.#isLoading = true;
    this.#ROOT.classList.add('-fetching');
    this.#STATUS.textContent = 'Getting data';
    fetch(
      `${App.aggregateRows}?togoKey=${this.#condition.togoKey}&properties=${encodeURIComponent(JSON.stringify(this.#condition.attributes.map(property => property.query).concat(this.#condition.properties.map(property => property.query))))}&queryIds=${encodeURIComponent(JSON.stringify(this.#queryIds.slice(this.offset, this.offset + LIMIT)))}`,
      {
        signal: this.#abortController.signal
      })
      .then(responce => responce.json())
      .then(rows => {
        console.log(rows)
        this.#rows.push(...rows);
        this.#isLoading = false;
        this.#isCompleted = this.offset >= this.#queryIds.length;
        // display
        this.#ROOT.classList.remove('-fetching');
        this.#STATUS.textContent = 'Awaiting';
        this.#INDICATOR_TEXT_AMOUNT.innerHTML = `${this.offset.toLocaleString()} / ${this.#queryIds.length.toLocaleString()}`;
        this.#INDICATOR_BAR.style.width = `${(this.offset / this.#queryIds.length) * 100}%`;
        this.#updateRemainingTime();
        // dispatch event
        const customEvent = new CustomEvent(event.addNextRows, {detail: {
          tableData: this,
          rows,
          done: this.#isCompleted
        }});
        DefaultEventEmitter.dispatchEvent(customEvent);
        // turn off after finished
        if (this.#isCompleted) {
          this.#complete();
        } else if (this.#isAutoLoad) {
          this.#getProperties();
        }
      })
      .catch(error => {
        this.#ROOT.classList.remove('-fetching');
        console.error(error) // TODO:
      });
  };
  
  #updateRemainingTime() {
    let singleTime = (Date.now() - this.#startTime) / this.offset; 
    let remainingTime;
    if (this.offset == 0) {
      remainingTime = '';
    } else if (this.offset >= this.#queryIds.length) {
      remainingTime = 0;
    } else {
      remainingTime = singleTime * this.#queryIds.length * (this.#queryIds.length - this.offset) / this.#queryIds.length / 1000;
    }
    if (remainingTime >= 3600) {
      this.#INDICATOR_TEXT_TIME.innerHTML = `${Math.round(remainingTime / 3600)} hr.`;
    } else if (remainingTime >= 60) {
      this.#INDICATOR_TEXT_TIME.innerHTML = `${Math.round(remainingTime / 60)} min.`;
    } else if (remainingTime >= 0) {
      this.#INDICATOR_TEXT_TIME.innerHTML = `${Math.floor(remainingTime)} sec.`;
    } else {
      this.#INDICATOR_TEXT_TIME.innerHTML = ``;
    }
  };
  
  #autoLoad() {
    if (this.#isCompleted) return;
    this.#isAutoLoad = true;
    this.#ROOT.classList.add('-autoload');
    this.#getProperties();
  }

  #complete() {
    this.#ROOT.dataset.status = 'complete';
    this.#STATUS.textContent = 'Complete';
    this.#setJsonUrl();
    this.#setTsvUrl();
    if (this.#downloadReserveButton ) {
      this.#downloadReserveButton.querySelector(':scope > a').click();
    }
  }
  #changeButtons() {
    this.#BUTTON_PREPARE_DATA.classList.remove('none');
    this.#BUTTON_DOWNLOAD_JSON.classList.add('none');
    this.#BUTTON_DOWNLOAD_TSV.classList.add('none');
    this.#BUTTON_PREPARE_DATA.classList.add('-rotating');
  }

  #setJsonUrl() {
    const jsonBlob = new Blob([JSON.stringify(this.#rows, null, 2)], {type : 'application/json'});
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const anchor = this.#BUTTON_DOWNLOAD_JSON.querySelector(':scope > .json');
    anchor.setAttribute('href', jsonUrl);
    anchor.setAttribute('download', 'sample.json');
  }

  #setTsvUrl() {
    const temporaryArray = [];
    this.#rows.map(row => {
      row.properties.map(property => {
        property.attributes.map(attribute => {
          const singleItem = {
            togoKey: this.#condition.togoKey,
            togoKeyId: row.id,
            attributeId: property.propertyId,
            attributeValue: attribute.attribute.label,
            attributeKey: property.propertyKey,
            attributeKeyId: attribute.id
          }
          temporaryArray.push(singleItem);
        })
      })
    })
    const tsvArray = [];
    tsvArray.push(Object.keys(temporaryArray[0]));
    console.log(tsvArray);
    temporaryArray.forEach(item => {
      tsvArray.push(Object.values(item));
    })
    console.log(tsvArray);
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const tsvBlob = new Blob([bom, tsvArray.join('\n')], { type: 'text/plain' });
    const tsvUrl = URL.createObjectURL(tsvBlob);
    const anchor = this.#BUTTON_DOWNLOAD_TSV.querySelector(':scope > .tsv');
    anchor.setAttribute('href', tsvUrl);
    anchor.setAttribute('download', 'sample.tsv');
  }

  /* public methods */

  select() {
    this.#ROOT.classList.add('-current');
    // dispatch event
    const customEvent1 = new CustomEvent(event.selectTableData, {detail: this});
    DefaultEventEmitter.dispatchEvent(customEvent1);
    // send rows
    if (this.#ROOT.dataset.status !== 'load ids') {
      const done = this.offset >= this.#queryIds.length;
      const customEvent2 = new CustomEvent(event.addNextRows, {detail: {
        tableData: this, 
        rows: this.#rows,
        done
      }});
      DefaultEventEmitter.dispatchEvent(customEvent2);
    }
  }

  deselect() {
    this.#ROOT.classList.remove('-current');
  }

  next() {
    if (this.#isAutoLoad) return;
    this.#getProperties();
  }

  /* public accessors */

  get offset() {
    return this.#rows.length;
  }
  get togoKey() {
    return this.condition.togoKey;
  }
  get subjectId() {
    return this.condition.subjectId;
  }
  get condition() {
    return this.#condition;
  }
  get serializedHeader() {
    return this.#serializedHeader;
  }
  get data() {
    return this.#rows;
  }
  get rateOfProgress() {
    return this.#rows.length / this.#queryIds.length;
  }
}