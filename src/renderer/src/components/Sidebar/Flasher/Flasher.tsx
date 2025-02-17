/*
Окно загрузчика
*/
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { ClientStatus } from '@renderer/components/Modules/Websocket/ClientStatus';
import { useAddressBook } from '@renderer/hooks/useAddressBook';
import { useModal } from '@renderer/hooks/useModal';
import { useSettings } from '@renderer/hooks/useSettings';
import { useFlasher } from '@renderer/store/useFlasher';
import { useManagerMS } from '@renderer/store/useManagerMS';
import {
  AddressData,
  FirmwareTargetType,
  FlashTableItem,
  OperationType,
} from '@renderer/types/FlasherTypes';

import { AddressBookModal } from './AddressBook';
import { AddressEntryEditModal } from './AddressEntryModal';
import { FlasherTable } from './FlasherTable';
import { MsGetAddressModal } from './MsGetAddressModal';

import { ManagerMS } from '../../Modules/ManagerMS';
import { Switch, WithHint } from '../../UI';

export const FlasherTab: React.FC = () => {
  const {
    device,
    log,
    address: serverAddress,
    setAddress: setServerAddress,
    meta,
    compilerData,
  } = useManagerMS();
  const {
    addressBookSetting,
    onEdit,
    getID,
    getEntryById,
    onAdd,
    onRemove,
    onSwapEntries,
    idCounter,
  } = useAddressBook();
  const { connectionStatus } = useFlasher();

  const [managerMSSetting, setManagerMSSetting] = useSettings('managerMS');

  const [isAddressBookOpen, openAddressBook, closeAddressBook] = useModal(false);
  const [isMsGetAddressOpen, openMsGetAddressModal, closeMsGetAddressModal] = useModal(false);

  const [isAddressEnrtyEditOpen, openAddressEnrtyEdit, closeAddressEnrtyEdit] = useModal(false); // для редактирования существующих записей в адресной книге
  const addressEntryEditForm = useForm<AddressData>();
  const [isAddressEnrtyAddOpen, openAddressEnrtyAdd, closeAddressEnrtyAdd] = useModal(false); // для добавления новых записей в адресную книгу
  const addressEntryAddForm = useForm<AddressData>();

  const [flashTableData, setFlashTableData] = useState<FlashTableItem[]>([]);

  const noAccessToDevice = device === undefined || connectionStatus !== ClientStatus.CONNECTED;
  const commonOperationDisabled =
    noAccessToDevice ||
    flashTableData.find((item) => {
      return item.isSelected;
    }) === undefined;

  const logContainerRef = useRef<HTMLDivElement>(null);

  // При изменении log прокручиваем вниз, если включена автопрокрутка
  useLayoutEffect(() => {
    if (managerMSSetting?.autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [log, managerMSSetting]);

  const addToTable = (item: FlashTableItem) => {
    if (
      flashTableData.find((v) => {
        return v.targetId === item.targetId;
      }) !== undefined
    ) {
      return false;
    }
    setFlashTableData([...flashTableData, item]);
    return true;
  };

  const removeFromTable = (ID: number) => {
    const tableIndex = flashTableData.findIndex((v) => {
      return v.targetId === ID;
    });
    if (tableIndex === -1) return;
    setFlashTableData(flashTableData.toSpliced(tableIndex, 1));
  };

  useEffect(() => {
    if (serverAddress === '' || addressBookSetting === null) return;
    setServerAddress('');
    const index = addressBookSetting.findIndex((v) => {
      return v.address === serverAddress;
    });
    let ID: number | null;
    if (index === -1) {
      onAdd({ name: '', address: serverAddress, type: '', meta: undefined });
      ID = idCounter;
    } else {
      ID = getID(index);
      if (ID === null) {
        ManagerMS.addLog(
          'Ошибка подключения платы! Индекс записи присутствует в таблице, но её ID не удалось определить!'
        );
        return;
      }
    }
    const isAdded = addToTable({
      isFile: false,
      isSelected: true,
      targetId: ID,
      targetType: FirmwareTargetType.tjc_ms,
    });
    if (!isAdded) {
      const entry = getEntryById(ID);
      if (entry === undefined) {
        return;
      }
      ManagerMS.addLog(
        `Устройство ${ManagerMS.displayAddressInfo(entry)} уже было добавлено в таблицу ранее.`
      );
    }
  }, [serverAddress]);

  useEffect(() => {
    if (!meta || addressBookSetting === null) return;
    const metaStr = `
- bootloader REF_HW: ${meta.RefBlHw} (${meta.type})
- bootloader REF_FW: ${meta.RefBlFw}
- bootloader REF_CHIP: ${meta.RefBlChip}
- booloader REF_PROTOCOL: ${meta.RefBlProtocol}
- cybergene REF_FW: ${meta.RefCgFw}
- cybergene REF_HW: ${meta.RefCgHw}
- cybergene REF_PROTOCOL: ${meta.RefCgProtocol}
    `;
    const op = ManagerMS.finishOperation(`Получены метаданные: ${metaStr}`);
    if (op === undefined) {
      return;
    }
    const index = addressBookSetting.findIndex((v) => {
      return v.address === op.addressInfo.address;
    });
    if (index === -1) {
      return;
    }
    const entry = addressBookSetting[index];
    onEdit(
      {
        name: entry.name,
        address: entry.address,
        type: meta.type,
        meta: {
          RefBlHw: meta.RefBlHw,
          RefBlFw: meta.RefBlFw,
          RefBlUserCode: meta.RefBlUserCode,
          RefBlChip: meta.RefBlChip,
          RefBlProtocol: meta.RefBlProtocol,
          RefCgHw: meta.RefCgHw,
          RefCgFw: meta.RefCgFw,
          RefCgProtocol: meta.RefCgProtocol,
        },
      },
      index
    );
  }, [meta]);

  useEffect(() => {
    if (device === undefined) {
      ManagerMS.addLog('Потеряно соединение с устройством.');
      return;
    }
  }, [device]);

  const handleGetAddress = () => {
    if (!device || !managerMSSetting) return;
    if (!managerMSSetting.hideGetAddressModal) {
      openMsGetAddressModal();
    } else {
      ManagerMS.getAddress(device.deviceID);
    }
  };
  const handleOpenAddressBook = () => {
    openAddressBook();
  };

  const handleOperation = (op: OperationType) => {
    if (!device) return;
    for (const item of flashTableData) {
      if (item.isSelected) {
        const addr = getEntryById(item.targetId);
        if (addr === undefined) {
          continue;
        }
        ManagerMS.addOperation({
          addressInfo: addr,
          deviceId: device.deviceID,
          type: op,
        });
      }
    }
  };

  const handleSendBin = async () => {
    if (!addressBookSetting) {
      ManagerMS.addLog('Ошибка! Адресная книга не загрузилась!');
      return;
    }
    if (!device) {
      ManagerMS.addLog('Прошивку начать нельзя! Выберите устройство!');
      return;
    }
    for (const item of flashTableData) {
      if (!item.isSelected) continue;
      const entry = getEntryById(item.targetId);
      // значит адрес или машина состояний были удалены
      if (entry === undefined) {
        ManagerMS.addLog(
          `Ошибка! Не удаётся найти адрес для ${
            item.isFile ? 'файла с прошивкой' : 'машины состояний'
          } (${item.source}). Возможно Вы удалили адрес или ${
            item.isFile ? 'файл с прошивкой' : 'машину состояний'
          }.`
        );
        continue;
      }
      if (!item.source) {
        ManagerMS.addLog(
          `Не удалось прошить ${ManagerMS.displayAddressInfo(
            entry
          )}, так как для неё не указана прошивка.`
        );
        continue;
      }
      if (item.isFile) {
        const [binData, errorMessage] = await window.api.fileHandlers.readFile(item.source);
        if (errorMessage !== null) {
          ManagerMS.addLog(
            `Ошибка! Не удалось извлечь данные из файла ${item.source}. Текст ошибки: ${errorMessage}`
          );
          continue;
        }
        if (binData !== null) {
          ManagerMS.binAdd({
            addressInfo: entry,
            device: device,
            verification: managerMSSetting ? managerMSSetting.verification : false,
            binaries: new Blob([binData]),
            isFile: true,
          });
        }
      } else {
        const noBinary = `${ManagerMS.displayAddressInfo(
          entry
        )}: отсутствуют бинарные данные для выбранной машины состояния. Перейдите во вкладку компилятор, чтобы скомпилировать схему.`;
        if (!compilerData) {
          ManagerMS.addLog(noBinary);
          continue;
        }
        const smData = compilerData.state_machines[item.source];
        if (!smData || !smData.binary || smData.binary.length === 0) {
          ManagerMS.addLog(noBinary);
          continue;
        }
        ManagerMS.binAdd({
          addressInfo: entry,
          device: device,
          verification: managerMSSetting ? managerMSSetting.verification : false,
          binaries: smData.binary,
          isFile: false,
        });
      }
    }
    ManagerMS.binStart();
  };

  const handleRemoveDevs = () => {
    const newTable: FlashTableItem[] = [];
    for (const item of flashTableData) {
      if (!item.isSelected) {
        newTable.push(item);
      }
    }
    setFlashTableData(newTable);
  };

  const handleCurrentDeviceDisplay = () => {
    const prefix = 'Статус';
    if (connectionStatus !== ClientStatus.CONNECTED) {
      return `${prefix}: отсутствует подключение к загрузчику. Проверьте его статус на соответствующей вкладке`;
    }
    if (device === undefined) {
      return `${prefix}: устройство отсутствует. Выберите МС-ТЮК во вкладке загрузчик`;
    }
    return `${prefix}: устройство ${device.displayName()} подключено`;
  };

  /**
   * Обновление адресной книги после редактирования
   */
  const addressEntryEditSubmitHandle = (data: AddressData) => {
    if (addressBookSetting === null) return;
    // TODO: найти более оптимальный вариант
    const index = addressBookSetting.findIndex((entry) => {
      return entry.address === data.address;
    });
    if (index === -1) return;
    onEdit(data, index);
  };

  const addressEntryAddSubmitHandle = (data: AddressData) => {
    addressEntryAddForm.reset();
    onAdd(data);
  };

  /**
   * Открытие модального окна для редактирования существующей записи в адресной книге
   * @param data данные, которые нужно отредактированть
   */
  const addressEnrtyEdit = (data: AddressData) => {
    addressEntryEditForm.reset(data);
    openAddressEnrtyEdit();
  };

  if (!managerMSSetting) {
    return null;
  }

  return (
    <section className="mr-3 flex h-full flex-col bg-bg-secondary">
      <label className="m-2">{handleCurrentDeviceDisplay()}</label>
      <div className="m-2">
        <button className="btn-primary mr-4" onClick={handleGetAddress} disabled={noAccessToDevice}>
          Подключить плату
        </button>
        <button className="btn-primary mr-4" onClick={handleOpenAddressBook}>
          Адреса плат МС-ТЮК
        </button>
      </div>
      <div className="m-2">
        <label>Устройства на прошивку</label>
        <FlasherTable
          addressEnrtyEdit={addressEnrtyEdit}
          getEntryById={getEntryById}
          setTableData={setFlashTableData}
          tableData={flashTableData}
        />
      </div>
      <div className="m-2 flex overflow-y-auto">
        <WithHint hint={'Убрать отмеченные платы из таблицы.'}>
          {(hintProps) => (
            <button {...hintProps} className="btn-error mr-6" onClick={handleRemoveDevs}>
              Убрать
            </button>
          )}
        </WithHint>
        <button
          className="btn-primary mr-4"
          onClick={() => handleSendBin()}
          disabled={commonOperationDisabled}
        >
          Прошить!
        </button>
        <div className="mr-4 flex w-40 items-center justify-between">
          <Switch
            checked={managerMSSetting.verification}
            onCheckedChange={() =>
              setManagerMSSetting({
                ...managerMSSetting,
                verification: !managerMSSetting.verification,
              })
            }
          />
          Верификация
        </div>
        <button
          className="btn-primary mr-4"
          onClick={() => handleOperation(OperationType.ping)}
          disabled={commonOperationDisabled}
        >
          Пинг
        </button>
        <button
          className="btn-primary mr-4"
          onClick={() => handleOperation(OperationType.reset)}
          disabled={commonOperationDisabled}
        >
          Перезагрузить
        </button>
        <button
          className="btn-primary mr-4"
          onClick={() => handleOperation(OperationType.meta)}
          disabled={commonOperationDisabled}
        >
          Получить метаданные
        </button>
      </div>
      <div className="m-2">Журнал действий</div>
      <div
        className="mx-2 h-72 overflow-y-auto whitespace-break-spaces bg-bg-primary scrollbar-thin scrollbar-track-scrollbar-track scrollbar-thumb-scrollbar-thumb"
        ref={logContainerRef}
      >
        {log.map((msg, index) => (
          <div key={index}>{msg}</div>
        ))}
      </div>
      <div className="m-2 flex flex-row-reverse">
        <button
          className="btn-primary"
          onClick={() => {
            ManagerMS.clearLog();
          }}
        >
          Очистить
        </button>
        <div className="mr-4 flex w-40 items-center justify-between">
          <Switch
            checked={managerMSSetting.autoScroll}
            onCheckedChange={() =>
              setManagerMSSetting({ ...managerMSSetting, autoScroll: !managerMSSetting.autoScroll })
            }
          />
          Автопрокрутка
        </div>
      </div>
      <AddressBookModal
        isOpen={isAddressBookOpen}
        onClose={closeAddressBook}
        onSubmit={(entryId: number) => {
          const isAdded = addToTable({
            targetId: entryId,
            isFile: false,
            isSelected: true,
            targetType: FirmwareTargetType.tjc_ms,
          });
          if (isAdded) {
            toast.info('Добавлена плата в таблицу прошивок!');
          } else {
            toast.info('Выбранная плата была добавлена в таблицу прошивок ранее');
          }
        }}
        addressBookSetting={addressBookSetting}
        getID={getID}
        onRemove={(index) => {
          const id = getID(index);
          if (id !== null) {
            removeFromTable(id);
          }
          onRemove(index);
        }}
        onSwapEntries={onSwapEntries}
        addressEnrtyEdit={addressEnrtyEdit}
        openAddressEnrtyAdd={openAddressEnrtyAdd}
      />
      <AddressEntryEditModal
        addressBookSetting={addressBookSetting}
        form={addressEntryEditForm}
        isOpen={isAddressEnrtyEditOpen}
        onClose={closeAddressEnrtyEdit}
        onSubmit={addressEntryEditSubmitHandle}
        submitLabel="Сохранить"
        allowAddressEdit={false}
      />
      <AddressEntryEditModal
        addressBookSetting={addressBookSetting}
        form={addressEntryAddForm}
        isOpen={isAddressEnrtyAddOpen}
        onClose={closeAddressEnrtyAdd}
        onSubmit={addressEntryAddSubmitHandle}
        submitLabel="Добавить"
        allowAddressEdit={true}
      />
      <MsGetAddressModal
        isOpen={isMsGetAddressOpen}
        onClose={closeMsGetAddressModal}
        onSubmit={() => {
          if (!device) return;
          ManagerMS.getAddress(device.deviceID);
        }}
        onNoRemind={() => {
          setManagerMSSetting({
            ...managerMSSetting,
            hideGetAddressModal: true,
          });
        }}
      />
    </section>
  );
};
