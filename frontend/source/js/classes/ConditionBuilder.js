import DefaultEventEmitter from "./DefaultEventEmitter";
import Records from "./Records";
import * as event from '../events';

class ConditionBuilder {

  #propertyConditions;
  #attributeConditions;
  #subjectId;
  #togoKey;
  #userIds;

  constructor() {
    this.#propertyConditions = [];
    this.#attributeConditions = [];
  }

  // public methods

  addProperty(condition) {
    console.log('addProperty', condition)
    // store
    this.#propertyConditions.push(condition);
    // evaluate
    this.#satisfyAggregation();
    // dispatch event
    const customEvent = new CustomEvent(event.mutatePropertyCondition, {detail: {
      action: 'add', 
      condition
    }});
    DefaultEventEmitter.dispatchEvent(customEvent);
  }

  addPropertyValue(condition) {
    console.log('add condition', condition)
    // store
    this.#attributeConditions.push(condition);
    // evaluate
    this.#satisfyAggregation();
    // dispatch event
    const customEvent = new CustomEvent(event.mutatePropertyValueCondition, {detail: {
      action: 'add', 
      condition
    }});
    DefaultEventEmitter.dispatchEvent(customEvent);
  }

  removeProperty(propertyId) {
    // remove from store
    const index = this.#propertyConditions.findIndex(condition => condition.property.propertyId === propertyId);
    if (index === -1) return;
    this.#propertyConditions.splice(index, 1)[0];
    // evaluate
    this.#satisfyAggregation();
    // dispatch event
    const customEvent = new CustomEvent(event.mutatePropertyCondition, {detail: {action: 'remove', propertyId}});
    DefaultEventEmitter.dispatchEvent(customEvent);
  }

  removePropertyValue(propertyId, categoryId) {
    // remove from store
    const index = this.#attributeConditions.findIndex(condition => condition.property.propertyId === propertyId && condition.value.categoryId === categoryId);
    if (index === -1) return;
    this.#attributeConditions.splice(index, 1)[0];
    // evaluate
    this.#satisfyAggregation();
    // dispatch event
    const customEvent = new CustomEvent(event.mutatePropertyValueCondition, {detail: {action: 'remove', propertyId, categoryId}});
    DefaultEventEmitter.dispatchEvent(customEvent);
  }

  setPropertyValues(condition) {
    const originalValues = Records.getProperty(condition.property.propertyId).values;
    const startIndex = originalValues.findIndex(originalValue => originalValue.categoryId === condition.values[0].categoryId);
    originalValues.forEach((originalValue, originalIndex) => {
      const index = this.#attributeConditions.findIndex(attrCondition => attrCondition.property.propertyId === condition.property.propertyId && attrCondition.value.categoryId === originalValue.categoryId);
      if (startIndex <= originalIndex && originalIndex < startIndex + condition.values.length) {
        const value = condition.values[originalIndex - startIndex];
        // add
        if (index === -1) {
          this.addPropertyValue({
            subject: condition.subject,
            property: condition.property,
            value 
          });
        }
      } else {
        // remove
        if (index !== -1) {
          this.removePropertyValue(condition.property.propertyId, originalValue.categoryId);
        }
      }
    });
  }

  makeQueryParameter() {
    // create properties
    const properties = this.#propertyConditions.map(condition => {
      return {
        query: {
          propertyId: condition.property.propertyId
        },
        property: condition.property,
        subject: condition.subject
      };
    });
    const attributesForEachProperties = {};
    this.#attributeConditions.forEach(condition => {
      const propertyId = condition.property.propertyId;
      if (!attributesForEachProperties[propertyId]) attributesForEachProperties[propertyId] = [];
      attributesForEachProperties[propertyId].push(condition.value.categoryId);
    });
    // create attributes (property values)
    const attributes = Object.keys(attributesForEachProperties).map(propertyId => {
      return {
        query: {
          propertyId,
          categoryIds: attributesForEachProperties[propertyId]
        },
        property: this.#attributeConditions.find(condition => condition.property.propertyId === propertyId).property,
        subject: this.#attributeConditions.find(condition => condition.property.propertyId === propertyId).subject
      };
    });
    // emmit event
    const customEvent = new CustomEvent(event.completeQueryParameter, {detail: {
      togoKey: this.#togoKey,
      subjectId: this.#subjectId,
      properties,
      attributes
    }});
    DefaultEventEmitter.dispatchEvent(customEvent);
  }

  setSubject(togoKey, subjectId) {
    this.#togoKey = togoKey;
    this.#subjectId = subjectId;
    this.#satisfyAggregation();
  }

  setUserIds(ids) {
    console.log(ids)
    this.#userIds = ids;
  }

  // public accessor

  get currentTogoKey() {
    return this.#togoKey;
  }

  get userIds() {
    return this.#userIds === '' ? undefined : this.#userIds;
  }

  // private methods

  #satisfyAggregation() {
    const established 
      = (this.#togoKey && this.#subjectId)
      && (this.#propertyConditions.length > 0 || this.#attributeConditions.length > 0);
    const customEvent = new CustomEvent(event.mutateEstablishConditions, {detail: established});
    DefaultEventEmitter.dispatchEvent(customEvent);
  }

}

export default new ConditionBuilder();
