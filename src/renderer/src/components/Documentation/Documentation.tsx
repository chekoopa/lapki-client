import { useState, useEffect } from 'react';
import { Tree } from './components/Tree';
import Show from './components/Show';

/*Загрузка документации*/
import { twMerge } from 'tailwind-merge';

export function Documentations({ baseUrl }: { baseUrl: string }) {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [data, setData] = useState<{ body: File }>();
  const [html, setHtml] = useState('');
  const [documentLink, setDocumentLink] = useState('');

  const getData = () => {
    fetch(baseUrl)
      .then((data) => data.json())
      .then((data) => {
        setData(data);
      });
  };

  const onItemClicked = (event: React.MouseEvent<HTMLLIElement, MouseEvent>, item) => {
    event.stopPropagation();
    if (item.path.endsWith('html')) {
      fetch(encodeURI(`${baseUrl}${item.path}`))
        .then((data) => data.text())
        .then((html) => {
          setHtml(html);
          setActiveTab(1);
        });
    } else {
      setHtml('');
      setDocumentLink(`${baseUrl}${item.path}`);
      setActiveTab(1);
    }
  };

  useEffect(() => {
    getData();
  }, []);

  return (
    <section className="flex h-full select-none flex-col border-l-[1px] border-[#4391BF] bg-bg-secondary px-1 py-4 text-base">
      <div className="flex gap-1 py-2">
        <button
          className={twMerge(
            'w-1/2 border border-[#4391BF] p-2',
            activeTab === 0 && 'bg-[#4391BF] bg-opacity-50'
          )}
          onClick={() => setActiveTab(0)}
        >
          Содержание
        </button>
        <button
          className={twMerge(
            'w-1/2 border border-[#4391BF] p-2',
            activeTab === 1 && 'bg-[#4391BF] bg-opacity-50'
          )}
          onClick={() => setActiveTab(1)}
        >
          Просмотр
        </button>
      </div>

      {/* <input
        type="text"
        placeholder="Поиск"
        className="mb-2 border border-[#4391BF] px-4 py-2 outline-none"
      /> */}

      <div className="h-full overflow-y-auto">
        <div className={twMerge(activeTab !== 0 && 'hidden')}>
          {data ? (
            <Tree root={data.body} borderWidth={0} onItemClicked={onItemClicked} />
          ) : (
            <span>Загрузка</span>
          )}
        </div>

        <div className={twMerge('h-full', activeTab !== 1 && 'hidden')}>
          <Show html={html} documentLink={documentLink} />
        </div>
      </div>
    </section>
  );
}