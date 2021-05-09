import DefaultEventEmitter from './DefaultEventEmitter';
import Records from './Records';
import * as eve_nt from '../events';

const PATH = 'https://integbio.jp/togosite/sparqlist/api/';
const DATA_FROM_USER_IDS = 'data_from_user_ids';

export default class UploadUserIDsView {

  #BODY;
  #ROOT;
  #USER_KEY;
  #USER_IDS;

  constructor(elm) {

    this.#BODY = document.querySelector('body');
    this.#ROOT = elm;
    const form = elm.querySelector(':scope > form');
    this.#USER_KEY = form.querySelector(':scope > label > select');
    this.#USER_IDS = form.querySelector(':scope > label > input');

    // atache events
    form.querySelector(':scope > .buttons > button:nth-child(1)').addEventListener('click', e => {
      e.stopPropagation();
      this.#fetch();
      return false;
    });
    form.querySelector(':scope > .buttons > button:nth-child(2)').addEventListener('click', e => {
      e.stopPropagation();
      this.#clear();
      return false;
    });

    // event listeners
    DefaultEventEmitter.addEventListener(eve_nt.EVENT_defineTogoKey, e => {
      this.#defineTogoKeys(e.detail);
    });

  }

  // private methods

  #defineTogoKeys(togoKeys) {
    console.log(togoKeys)
    this.#USER_KEY.innerHTML = togoKeys.map(togoKey => `<option value="${togoKey.togoKey}" data-subject-id="${togoKeys.subjectId}">${togoKey.label} (${togoKey.togoKey})</option>`).join('');
  }

  #fetch() {

    console.log(this.#USER_KEY.value)
    const queryTemplate = `${PATH + DATA_FROM_USER_IDS}?sparqlet=@@sparqlet@@&primaryKey=@@primaryKey@@&categoryIds=&userKey=${this.#USER_KEY.value}&userIds=${encodeURIComponent(this.#USER_IDS.value)}`;

    Records.properties.forEach(property => {
      console.log(property)
      const propertyId = property.propertyId;
      fetch(queryTemplate
        .replace('@@sparqlet@@', encodeURIComponent(property.data))
        .replace('@@primaryKey@@', encodeURIComponent(property.primaryKey)))
      .then(responce => responce.json())
      .then(values => {
        console.log(values)
        this.#BODY.classList.add('-showuserids');
        // dispatch event
        const event = new CustomEvent(eve_nt.EVENT_setUserValues, {detail: {
          propertyId,
          values
        }});
        DefaultEventEmitter.dispatchEvent(event);
      });
    });

  }

  #clear() {
    this.#BODY.classList.remove('-showuserids');
    const event = new CustomEvent(eve_nt.EVENT_clearUserValues);
    DefaultEventEmitter.dispatchEvent(event);
  }

}
