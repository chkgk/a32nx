/*
 * A32NX
 * Copyright (C) 2020-2021 FlyByWire Simulations and its contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { connect } from 'react-redux';
import React, { useEffect, useState } from 'react';
import { IconCornerDownLeft, IconCornerDownRight, IconArrowDown, IconHandStop, IconTruck, IconBriefcase, IconBuildingArch, IconArchive, IconPlug, IconTir } from '@tabler/icons';
import './Ground.scss';
import fuselage from '../Assets/320neo-outline-upright.svg';
import { useSimVar, useSplitSimVar } from '../../Common/simVars';
import Button, { BUTTON_TYPE } from '../Components/Button/Button';
import { DoorToggle } from './DoorToggle';
import { BUTTON_STATE_REDUCER } from '../Store';
import {
    addActiveButton, removeActiveButton, setTugRequestOnly,
    setActiveButtons, addDisabledButton, removeDisabledButton,
} from '../Store/action-creator/ground-state';

type StatefulButton = {
    id: string,
    state: string
}

export const Ground = ({
    activeButtons, disabledButtons, tugRequestOnly,
    setTugRequestOnly, addActiveButton, removeActiveButton, setActiveButtons, addDisabledButton, removeDisabledButton,
}) => {
    const [jetWayActive, setJetWayActive] = useSplitSimVar('A:INTERACTIVE POINT OPEN:0', 'Percent over 100', 'K:TOGGLE_JETWAY', 'bool', 1000);
    const [_rampActive, setRampActive] = useSplitSimVar('A:INTERACTIVE POINT OPEN:0', 'Percent over 100', 'K:TOGGLE_RAMPTRUCK', 'bool', 1000);
    const [cargoActive, setCargoActive] = useSplitSimVar('A:INTERACTIVE POINT OPEN:5', 'Percent over 100', 'K:REQUEST_LUGGAGE', 'bool', 1000);
    const [cateringActive, setCateringActive] = useSplitSimVar('A:INTERACTIVE POINT OPEN:3', 'Percent over 100', 'K:REQUEST_CATERING', 'bool', 1000);

    const [fuelingActive, setFuelingActive] = useSplitSimVar('A:INTERACTIVE POINT OPEN:9', 'Percent over 100', 'K:REQUEST_FUEL_KEY', 'bool', 1000);
    const [tugHeading, setTugHeading] = useSplitSimVar('PLANE HEADING DEGREES TRUE', 'degrees', 'K:KEY_TUG_HEADING', 'UINT32', 1000);
    const [pushBack, setPushBack] = useSplitSimVar('PUSHBACK STATE', 'enum', 'K:TOGGLE_PUSHBACK', 'bool', 1000);
    const [powerActive, setPowerActive] = useSplitSimVar('A:INTERACTIVE POINT OPEN:8', 'Percent over 100', 'K:REQUEST_POWER_SUPPLY', 'bool', 1000);

    const [pushBackWait, setPushBackWait] = useSimVar('Pushback Wait', 'bool', 100);
    const [pushBackAttached] = useSimVar('Pushback Attached', 'bool', 1000);

    const [tugDirection, setTugDirection] = useState(0);
    const [tugActive, setTugActive] = useState(false);

    const buttonBlue = ' border-blue-500 bg-blue-500 hover:bg-blue-600 hover:border-blue-600 text-blue-darkest disabled:bg-grey-600';
    const buttonActive = ' text-white bg-green-600 border-green-600';

    const STATE_WAITING = 'WAITING';
    const STATE_ACTIVE = 'ACTIVE';
    /**
     * allows a direction to be selected directly
     * rather than first backwards and after that the direction
     */
    useEffect(() => {
        if (pushBack === 0 && tugDirection !== 0) {
            computeAndSetTugHeading(tugDirection);
            setTugDirection(0);
        }
        /**
         * Timer needed, as we cannot check when the variable "Pushback Wait" is being set to false after calling the tug
         */
        const timer = setInterval(() => {
            if (tugRequestOnly) {
                setPushBackWait(1);
            }
        }, 100);
        return () => clearInterval(timer);
    }, [pushBackWait, tugRequestOnly]);

    const getTugHeading = (value: number): number => (tugHeading + value) % 360;

    const computeAndSetTugHeading = (direction: number) => {
        if (tugRequestOnly) {
            setTugRequestOnly(false);
        }
        const tugHeading = getTugHeading(direction);
        // KEY_TUG_HEADING is an unsigned integer, so let's convert
        /* eslint no-bitwise: ["error", { "allow": ["&"] }] */
        setPushBackWait(0);
        setTugHeading((tugHeading * 11930465) & 0xffffffff);
        setTugDirection(direction);
    };

    const togglePushback = (callOnly: boolean = false) => {
        setPushBack(!pushBack);
        setTugActive(!tugActive);
        setTugRequestOnly(callOnly);
    };

    const handleClick = (callBack: () => void, event: React.MouseEvent, disabledButton?: string) => {
        if (!activeButtons.map((b: StatefulButton) => b.id).includes(event.currentTarget.id)) {
            addActiveButton({ id: event.currentTarget.id, state: STATE_WAITING });
            if (disabledButton) {
                addDisabledButton(disabledButton);
            }
            callBack();
        } else if (!tugActive) {
            const index = activeButtons.map((b: StatefulButton) => b.id).indexOf(event.currentTarget.id);
            if (index > -1) {
                removeActiveButton(index);
            }
            if (disabledButton) {
                const disabledIndex = disabledButtons.indexOf(disabledButton);
                removeDisabledButton(disabledIndex);
            }
            callBack();
        }
    };

    /**
     * Pushback actions disable all other services
     * So all highlighting should be removed as well
     */
    const handlePushBackClick = (callBack: () => void, event: React.MouseEvent) => {
        const tugRequest = 'tug-request';
        if (activeButtons.map((b: StatefulButton) => b.id).includes(tugRequest) && event.currentTarget.id === tugRequest) {
            setActiveButtons([]);
        } else {
            setActiveButtons([{ id: event.currentTarget.id, state: STATE_ACTIVE }, { id: tugRequest, state: STATE_WAITING }]);
        }
        callBack();
    };

    const applySelected = (className: string, id?: string) => {
        if (id) {
            return className + (activeButtons.map((b: StatefulButton) => b.id).includes(id) ? buttonActive
                : buttonBlue);
        }
        return className;
    };

    /**
     * Applies highlighting of an activated service based on SimVars
     * This ensures the displayed state is in sync with the active services
     */
    const applySelectedWithSync = (className: string, id: string, gameSync) => {
        const index = activeButtons.map((b: StatefulButton) => b.id).indexOf(id);
        const disabledIndex = disabledButtons.indexOf(id);
        if (gameSync > 0.5 && (index !== -1 || disabledIndex !== -1)) {
            const button: StatefulButton = activeButtons[index];
            if (button && button.state === STATE_WAITING) {
                button.state = STATE_ACTIVE;
                setActiveButtons(activeButtons);
            }
            return `${className} ${buttonActive}`;
        }
        if (gameSync === 0 && index !== -1) {
            const button: StatefulButton = activeButtons[index];
            if (button.state === STATE_ACTIVE) {
                removeActiveButton(index);
                removeDisabledButton(disabledIndex);
            }
        }
        return className + (activeButtons.map((b: StatefulButton) => b.id).includes(id) ? ' text-white bg-gray-600'
            : buttonBlue);
    };

    return (
        <div className="wrapper flex-grow flex flex-col">
            <img className="airplane w-full" src={fuselage} />
            <div className="left-1/4 grid grid-cols-2 control-grid absolute top-12">

                <div>
                    <h1 className="text-white font-medium text-xl text-center pb-1">Pax</h1>
                    <Button
                        onClick={(e) => handleClick(() => {
                            setJetWayActive(1);
                            setRampActive(1);
                        }, e, 'door-fwd-left')}
                        className={applySelectedWithSync('w-32 ', 'jetway', jetWayActive)}
                        type={BUTTON_TYPE.NONE}
                        id="jetway"
                    >
                        <IconBuildingArch size="2.825rem" stroke="1.5" />
                    </Button>
                </div>
                <div>
                    <h1 className="text-white font-medium text-xl text-center pb-1">Door Fwd</h1>
                    <DoorToggle index={0} clickCallback={handleClick} selectionCallback={applySelectedWithSync} id="door-fwd-left" disabled={disabledButtons.includes('door-fwd-left')} />
                </div>
            </div>

            <div className="left-1/4 grid grid-cols-1 control-grid absolute top-48">
                <div>
                    <h1 className="text-white font-medium text-xl text-center pb-1">Fuel</h1>
                    <Button
                        onClick={(e) => handleClick(() => setFuelingActive(1), e)}
                        className={applySelectedWithSync('w-32', 'fuel', fuelingActive)}
                        type={BUTTON_TYPE.NONE}
                        id="fuel"
                    >
                        <IconTruck size="2.825rem" stroke="1.5" />
                    </Button>
                </div>
            </div>

            <div className="right-1/4 grid grid-cols-2 control-grid absolute top-12">
                <div>
                    <h1 className="text-white font-medium text-xl text-center pb-1">Baggage</h1>
                    <Button
                        onClick={(e) => handleClick(() => setCargoActive(1), e)}
                        className={applySelectedWithSync('w-32', 'baggage', cargoActive)}
                        type={BUTTON_TYPE.NONE}
                        id="baggage"
                    >
                        <IconBriefcase size="2.825rem" stroke="1.5" />
                    </Button>
                </div>
                <div>
                    <h1 className="text-white font-medium text-xl text-center pb-1">Ext. Power</h1>
                    <Button
                        onClick={(e) => handleClick(() => setPowerActive(1), e)}
                        className={applySelectedWithSync('w-32', 'power', powerActive)}
                        type={BUTTON_TYPE.NONE}
                        id="power"
                    >
                        <IconPlug size="2.825rem" stroke="1.5" />
                    </Button>
                </div>
            </div>
            <div className="right-1/4 grid grid-cols-2 control-grid absolute bottom-36">
                <div>
                    <h1 className="text-white font-medium text-xl text-center pb-1">Door Aft</h1>
                    <DoorToggle index={3} clickCallback={handleClick} selectionCallback={applySelectedWithSync} id="door-aft-right" disabled={disabledButtons.includes('door-aft-right')} />
                </div>
                <div>
                    <h1 className="text-white font-medium text-xl text-center pb-1">Catering</h1>
                    <Button
                        onClick={(e) => handleClick(() => setCateringActive(1), e, 'door-aft-right')}
                        className={applySelectedWithSync('w-32', 'catering', cateringActive)}
                        type={BUTTON_TYPE.NONE}
                        id="catering"
                    >
                        <IconArchive size="2.825rem" stroke="1.5" />
                    </Button>
                </div>
            </div>

            <div className="left-0 ml-4 grid grid-cols-3 absolute bottom-16 control-grid">
                <div>
                    <h1 className="text-white font-medium text-xl text-center">Call Tug</h1>
                    <Button
                        id="tug-request"
                        onClick={(e) => handlePushBackClick(() => togglePushback(true), e)}
                        className={applySelectedWithSync('w-32', 'tug-request', pushBackAttached)}
                        type={BUTTON_TYPE.NONE}
                    >
                        <IconTir size="2.825rem" stroke="1.5" />
                    </Button>
                </div>

                <div className="stop">
                    <h1 className="text-white font-medium text-xl text-center">Pushback</h1>
                    <Button
                        id="stop"
                        onClick={(e) => handlePushBackClick(() => {
                            computeAndSetTugHeading(0);
                            setTugRequestOnly(true);
                        }, e)}
                        className={applySelected('w-32 stop bg-red-500 border-red-500 hover:bg-red-600 hover:border-red-600 text-blue-darkest')}
                        type={BUTTON_TYPE.NONE}
                    >
                        <IconHandStop size="2.825rem" stroke="1.5" />
                    </Button>
                </div>
                <Button
                    id="down-left"
                    type={BUTTON_TYPE.NONE}
                    onClick={(e) => handlePushBackClick(() => computeAndSetTugHeading(90), e)}
                    className={applySelected('w-32 down-left', 'down-left')}
                >
                    <IconCornerDownLeft size="2.825rem" stroke="1.5" />
                </Button>
                <Button
                    id="down"
                    type={BUTTON_TYPE.NONE}
                    onClick={(e) => handlePushBackClick(() => computeAndSetTugHeading(0), e)}
                    className={applySelected('down w-32', 'down')}
                >
                    <IconArrowDown size="2.825rem" stroke="1.5" />
                </Button>
                <Button
                    id="down-right"
                    type={BUTTON_TYPE.NONE}
                    onClick={(e) => handlePushBackClick(() => computeAndSetTugHeading(270), e)}
                    className={applySelected('w-32 down-right', 'down-right')}
                >
                    <IconCornerDownRight size="2.825rem" stroke="1.5" />
                </Button>
            </div>
        </div>
    );
};

export default connect(
    ({ [BUTTON_STATE_REDUCER]: { activeButtons, disabledButtons, tugRequestOnly } }) => ({ activeButtons, disabledButtons, tugRequestOnly }),
    { addActiveButton, removeActiveButton, setActiveButtons, addDisabledButton, removeDisabledButton, setTugRequestOnly },
)(Ground);
