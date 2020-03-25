import {GridElement} from "../model/GridElement";
import {speechService} from "./speechService";
import {constants} from "./../util/constants";
import {util} from "./../util/util";
import {predictionService} from "./predictionService";
import {i18nService} from "./i18nService";
import {fontUtil} from "../util/fontUtil";
import {GridActionCollectElement} from "../model/GridActionCollectElement";
import {GridActionNavigate} from "../model/GridActionNavigate";
import {GridActionSpeak} from "../model/GridActionSpeak";

var collectElementService = {};

var registeredCollectElements = [];
var collectedText = '';
let keyboardLikeFactor = 0;

collectElementService.initWithElements = function (elements) {
    registeredCollectElements = [];
    let oneCharacterElements = 0;
    let normalElements = 0;
    elements.forEach(element => {
        if (element && element.type === GridElement.ELEMENT_TYPE_NORMAL) {
            normalElements++;
            if (element.label && element.label.length === 1) {
                oneCharacterElements++;
            }
        }
        if (element && element.type === GridElement.ELEMENT_TYPE_COLLECT) {
            registeredCollectElements.push(JSON.parse(JSON.stringify(element)));
        }
    });
    keyboardLikeFactor = oneCharacterElements / normalElements;
    if (registeredCollectElements.length > 0) {
        let intervalHandler = setInterval(() => {
            if ($('.item[data-type="ELEMENT_TYPE_COLLECT"]').length > 0) {
                setText();
                predictionService.predict(collectedText);
                clearInterval(intervalHandler);
            }
        }, 100);
    }
};

collectElementService.doAction = function (elem) {
    if (getActionOfType(elem, 'GridActionPredict')) {
        predictionService.predict(collectedText);
    }
    let speakAction = elem.actions.filter(a => a.modelName === GridActionSpeak.getModelName())[0];
    let language = speakAction && speakAction.speakLanguage ? speakAction.speakLanguage : i18nService.getBrowserLang();
    speechService.speak(collectedText, language);
};

collectElementService.doCollectElementActions = function (action) {
    if (!action) {
        return;
    }
    switch (action) {
        case GridActionCollectElement.COLLECT_ACTION_CLEAR:
            setText('');
            break;
        case GridActionCollectElement.COLLECT_ACTION_REMOVE_WORD:
            let words = collectedText.trim().split(' ');
            words.pop();
            let text = words.join(' ');
            setText(text === '' ? '' : text + ' ');
            break;
        case GridActionCollectElement.COLLECT_ACTION_REMOVE_CHAR:
            setText(collectedText.substring(0, collectedText.length - 1));
            break;
        case GridActionCollectElement.COLLECT_ACTION_COPY_CLIPBOARD:
            util.copyToClipboard(collectedText);
            break;
        case GridActionCollectElement.COLLECT_ACTION_APPEND_CLIPBOARD:
            util.appendToClipboard(collectedText);
            break;
        case GridActionCollectElement.COLLECT_ACTION_CLEAR_CLIPBOARD:
            util.copyToClipboard('');
            break;
    }
    predictionService.predict(collectedText);
};

function setText(text) {
    text = text === undefined ? collectedText : text;
    collectedText = text;
    predictionService.learnFromInput(collectedText);
    $('.item[data-type="ELEMENT_TYPE_COLLECT"] .collect-text').text(collectedText);
    fontUtil.adaptFontSize($('.item[data-type="ELEMENT_TYPE_COLLECT"]'));
}

function getActionOfType(elem, type) {
    if (!elem) {
        return null;
    }
    let index = elem.actions.map(action => action.modelName).indexOf(type);
    if (index === -1) {
        return null;
    }
    return elem.actions[index];
}

function addText(text) {
    setText(collectedText + text);
}

$(window).on(constants.ELEMENT_EVENT_ID, function (event, element) {
    if (registeredCollectElements.length === 0) {
        return;
    }
    if (getActionOfType(element, GridActionCollectElement.getModelName())) {
        return; // no adding of text if the element contains actions for collect elements, e.g. "clear"
    }
    if (getActionOfType(element, GridActionNavigate.getModelName())) {
        return; // no adding of text if the element contains an navigate action
    }
    if (!element.type || element.type === GridElement.ELEMENT_TYPE_NORMAL) {
        if (!element.label) {
            return;
        }
        let textToAdd = element.label.length === 1 && keyboardLikeFactor > 0.5 ? element.label.toLowerCase() : element.label + ' ';
        addText(textToAdd);
        registeredCollectElements.forEach(collectElem => {
            let predictAction = getActionOfType(collectElem, 'GridActionPredict');
            if (predictAction && predictAction.suggestOnChange) {
                predictionService.predict(collectedText);
            }
        });
    }
    if (element.type && element.type === GridElement.ELEMENT_TYPE_PREDICTION) {
        let word = $(`#${element.id} .text-container span`).text();
        if (word) {
            let appliedText = predictionService.applyPrediction(collectedText || '', word);
            setText(appliedText);
            registeredCollectElements.forEach(collectElem => {
                let predictAction = getActionOfType(collectElem, 'GridActionPredict');
                if (predictAction && predictAction.suggestOnChange) {
                    predictionService.predict(collectedText);
                }
            });
        }
    }
});

export {collectElementService};