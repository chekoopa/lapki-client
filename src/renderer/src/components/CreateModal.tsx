import React, { useState } from 'react';

import { useForm } from 'react-hook-form';

import { ColorInput } from './Modal/ColorInput';
import { Modal } from './Modal/Modal';
import { twMerge } from 'tailwind-merge';
import { TextSelect } from './Modal/TextSelect';
import { CanvasEditor } from '@renderer/lib/CanvasEditor';
import { TextInput } from './Modal/TextInput';

interface CreateModalProps {
  editor?: CanvasEditor | null;
  isOpen: boolean;
  isData: { state } | undefined;
  isName: { state; position } | undefined;
  onOpenEventsModal: () => void;
  onClose: () => void;
  onSubmit: (data: CreateModalFormValues) => void;
}

export interface CreateModalFormValues {
  id: string;
  key: number;
  name: string;
  doComponent: string;
  doMethod: string;
  triggerComponent: string;
  triggerMethod: string;
  args: string;

  doComponentOneElse: string;
  doMethodOneElse: string;
  doComponentTwoElse: string;
  doMethodTwoElse: string;
  argsOneElse: string;
  argsTwoElse: string;
  color: string;
}

export const CreateModal: React.FC<CreateModalProps> = ({
  onSubmit,
  onOpenEventsModal,
  onClose,
  isData,
  isName,
  editor,
  ...props
}) => {
  const {
    register,
    reset,
    handleSubmit: hookHandleSubmit,
    formState: { errors },
  } = useForm<CreateModalFormValues>({
    defaultValues: {
      color: '#ffffff',
    },
  });

  const components = editor?.container.machine.components.keys();
  const methods = editor?.container.machine.platform.getAvailableEvents('System');
  console.log(components, methods);
  const onRequestClose = () => {
    onClose();
    // TODO: пока кажется лишним затирать текстовые поля
    reset({ color: '#ffffff' });
  };

  const handleSubmit = hookHandleSubmit((data) => {
    isName !== undefined
      ? ((data.id = isName?.state.id), data.name || (data.name = 'Состояние'), (data.key = 1))
      : isData !== undefined
      ? ((data.id = isData?.state.id), (data.name = isData?.state.data.name), (data.key = 2))
      : (data.key = 3);
    onSubmit(data);
  });

  const inputStyle = {
    left: isName?.position.x + 'px',
    top: isName?.position.y + 'px',
    width: isName?.position.width + 'px',
    height: isName?.position.height + 'px',
  };

  const [isElse, setIsElse] = useState(true);
  const [isParamOne, setIsParamOne] = useState(true);
  const [isParamTwo, setIsParamTwo] = useState(true);
  const handleIsElse = (event) => {
    if (event.target.checked) {
      setIsElse(false);
    } else {
      setIsElse(true);
    }
  };
  const handleParamOne = (event) => {
    if (event.target.checked) {
      setIsParamOne(false);
    } else {
      setIsParamOne(true);
    }
  };
  const handleParamTwo = (event) => {
    if (event.target.checked) {
      setIsParamTwo(false);
    } else {
      setIsParamTwo(true);
    }
  };

  const selectElse = ['>', '<', '=', '!=', '>=', '<='];
  return (
    <>
      {isName !== undefined ? (
        <>
          <input
            style={inputStyle}
            autoFocus
            onKeyUp={(e) => {
              var keyCode = e.keyCode;
              if (e.key === 'Enter') {
                handleSubmit();
              } else if (keyCode === 27) {
                onRequestClose();
              }
            }}
            className={twMerge(
              'fixed rounded-t-[6px] border-2 border-solid bg-[#525252] px-3 font-Fira text-white focus:outline-none'
            )}
            placeholder="Придумайте название"
            maxLength={20}
            {...register('name', {
              onBlur() {
                onRequestClose();
              },
              minLength: { value: 2, message: 'Минимум 2 символа!' },
              value: isName.state.data.name,
            })}
          />
        </>
      ) : (
        <>
          <Modal
            {...props}
            onRequestClose={onRequestClose}
            title={
              isData?.state.id !== undefined
                ? 'Редактирование состояния: ' + JSON.stringify(isData?.state.data.name)
                : 'Редактор соединения'
            }
            onSubmit={handleSubmit}
            submitLabel="Сохранить"
          >
            {!isData || (
              <div className="flex items-end">
                <TextSelect
                  label="Событие:"
                  placeholder="Выберите модуль события"
                  {...register('triggerComponent', {
                    required: 'Это поле обязательно к заполнению!',
                  })}
                  error={!!errors.triggerComponent}
                  errorMessage={errors.triggerComponent?.message ?? ''}
                />
                <TextSelect
                  label=""
                  placeholder="Выберите действие события"
                  {...register('triggerMethod', {
                    required: 'Это поле обязательно к заполнению!',
                  })}
                  error={!!errors.triggerMethod}
                  errorMessage={errors.triggerMethod?.message ?? ''}
                />
              </div>
            )}
            <button
              type="button"
              className="rounded bg-neutral-700 px-4 py-2 transition-colors hover:bg-neutral-600"
              onClick={onOpenEventsModal}
            >
              Выбрать действие
            </button>
            {isData !== undefined || (
              <>
                <div className="flex">
                  <input type="checkbox" onChange={handleIsElse} className="mr-2" />
                  <p>Условие</p>
                </div>
                <div className="flex">
                  <input
                    type="checkbox"
                    disabled={isElse}
                    onChange={handleParamOne}
                    className="mr-2"
                  />
                  {isParamOne ? (
                    <>
                      <TextSelect
                        label="Компонент:"
                        placeholder="Выберите компонент события"
                        {...register('doComponentOneElse', {
                          required: 'Это поле обязательно к заполнению!',
                        })}
                        disabled={isElse}
                        error={!!errors.doComponentOneElse}
                        errorMessage={errors.doComponentOneElse?.message ?? ''}
                      />
                      <TextSelect
                        label="Метод:"
                        placeholder="Выберите метод события"
                        {...register('doMethodOneElse', {
                          required: 'Это поле обязательно к заполнению!',
                        })}
                        disabled={isElse}
                        error={!!errors.doMethodOneElse}
                        errorMessage={errors.doMethodOneElse?.message ?? ''}
                      />
                    </>
                  ) : (
                    <TextInput
                      label="Параметр:"
                      placeholder="Напишите параметр"
                      {...register('argsOneElse', {
                        required: 'Это поле обязательно к заполнению!',
                      })}
                      disabled={isElse}
                      error={!!errors.argsOneElse}
                      errorMessage={errors.argsOneElse?.message ?? ''}
                    />
                  )}
                </div>
                <select
                  disabled={isElse}
                  className="ml-6 w-[80px] rounded border bg-transparent px-2 py-1 text-center text-white"
                >
                  {selectElse.map((content) => (
                    <option
                      key={'option' + content}
                      className="bg-neutral-800"
                      value={content}
                      label={content}
                    ></option>
                  ))}
                </select>
                <div className="flex">
                  <input
                    type="checkbox"
                    disabled={isElse}
                    onChange={handleParamTwo}
                    className="mr-2"
                  />
                  {isParamTwo ? (
                    <>
                      <TextSelect
                        label="Компонент:"
                        placeholder="Выберите компонент события"
                        {...register('doComponentTwoElse', {
                          required: 'Это поле обязательно к заполнению!',
                        })}
                        disabled={isElse}
                        error={!!errors.doComponentTwoElse}
                        errorMessage={errors.doComponentTwoElse?.message ?? ''}
                      />
                      <TextSelect
                        label="Метод:"
                        placeholder="Выберите метод события"
                        {...register('doMethodTwoElse', {
                          required: 'Это поле обязательно к заполнению!',
                        })}
                        disabled={isElse}
                        error={!!errors.doMethodTwoElse}
                        errorMessage={errors.doMethodTwoElse?.message ?? ''}
                      />
                    </>
                  ) : (
                    <TextInput
                      label="Параметр:"
                      placeholder="Напишите параметр"
                      {...register('argsTwoElse', {
                        required: 'Это поле обязательно к заполнению!',
                      })}
                      disabled={isElse}
                      error={!!errors.argsTwoElse}
                      errorMessage={errors.argsTwoElse?.message ?? ''}
                    />
                  )}
                </div>

                <ColorInput
                  label="Цвет связи:"
                  {...register('color', { required: 'Это поле обязательно к заполнению!' })}
                  error={!!errors.color}
                  errorMessage={errors.color?.message ?? ''}
                />
              </>
            )}
          </Modal>
        </>
      )}
    </>
  );
};