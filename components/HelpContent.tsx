
import React from 'react';

export const HelpContent: React.FC = () => (
    <div className="space-y-6 text-gray-300 prose prose-invert prose-sm max-w-none">
        {/* Section: App Description */}
        <section>
            <h3 className="text-xl font-semibold text-white">Описание приложения: "Упаковщик статичных сайтов"</h3>
            <p>Добро пожаловать в "Упаковщик статичных сайтов" — ваш универсальный инструмент для быстрой и эффективной подготовки веб-проектов к публикации!</p>
            <p>Вы создали красивый статичный сайт, лендинг или портфолио, и теперь хотите разместить его в интернете? Наше приложение упрощает этот процесс, превращая рутинные задачи в несколько кликов.</p>
            
            <h4 className="text-lg font-semibold text-white mt-4">Что делает это приложение?</h4>
            <p>Оно берет ваши исходные файлы (HTML, CSS, JavaScript, изображения) и превращает их в оптимизированный, готовый к развертыванию ZIP-архив. Больше не нужно вручную переименовывать файлы, обновлять ссылки и настраивать структуру перед загрузкой на хостинг.</p>

            <h4 className="text-lg font-semibold text-white mt-4">Ключевые возможности:</h4>
            <ul className="list-disc list-inside space-y-2">
                <li><strong>Умные плейсхолдеры (текст и ссылки):</strong> Используйте метки, чтобы вставлять не только текст (<code>{`{{ email }}`}</code>), но и создавать ссылки между страницами (<code>{`{{ link_to_about }}`}</code>). Приложение автоматически обновит все ссылки, если вы переименуете файлы, защищая вас от "битых" ссылок.</li>
                <li><strong>Глобальные скрипты:</strong> Вставьте код Яндекс.Метрики или Google Analytics один раз, и он автоматически добавится на все страницы вашего сайта перед тегом <code>&lt;/head&gt;</code>.</li>
                <li><strong>SEO-оптимизация с помощью ИИ:</strong> Улучшите поисковую видимость вашего сайта. Наш инструмент с помощью искусственного интеллекта от Google Gemini проанализирует контент ваших страниц и предложит короткие, понятные и SEO-дружелюбные имена для файлов (например, <code>about-us.html</code> вместо <code>page2.html</code>).</li>
                <li><strong>Умная упаковка:</strong> Приложение автоматически переименовывает главную страницу в <code>index.html</code>, обновляет все внутренние ссылки между страницами и упаковывает проект в единый ZIP-архив.</li>
                <li><strong>Готовность к развертыванию:</strong> Внутри архива вы найдете не только файлы сайта, но и простые инструкции для его публикации на популярных платформах, таких как <strong>GitHub Pages</strong> и <strong>Vercel</strong>.</li>
            </ul>
             <p className="mt-4">С "Упаковщиком статичных сайтов" вы экономите время и силы, получая профессионально подготовленный проект, готовый к запуску за считанные минуты.</p>
        </section>

        <div className="border-t border-gray-700 my-6"></div>

        {/* Section: User Guide */}
        <section>
            <h3 className="text-xl font-semibold text-white">Инструкция по использованию для новых пользователей</h3>
            <p>Это пошаговое руководство поможет вам быстро освоить все функции приложения.</p>
            
            <h4 className="text-lg font-semibold text-white mt-4">Шаг 1: Загрузка вашего сайта</h4>
            <ol className="list-decimal list-inside space-y-2">
                <li><strong>Начало работы:</strong> На приветственном экране нажмите кнопку <strong>"Начать работу"</strong>.</li>
                <li><strong>Выберите способ загрузки:</strong>
                    <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                         <li><strong>Перетаскивание (Drag & Drop):</strong> Просто перетащите папку с вашим сайтом или отдельные файлы прямо в пунктирную область на экране.</li>
                         <li><strong>Выбор вручную:</strong>
                             <ul className="list-disc list-inside ml-6 mt-1">
                                 <li>Нажмите <strong>"Выбрать папку"</strong>, чтобы загрузить всю структуру вашего проекта целиком (рекомендуется).</li>
                                 <li>Нажмите <strong>"Выбрать файлы"</strong>, если хотите загрузить только определенные файлы.</li>
                             </ul>
                         </li>
                    </ul>
                </li>
                <li>После загрузки приложение проанализирует ваши HTML-страницы и отобразит их в виде карточек с предпросмотром.</li>
            </ol>

            <h4 className="text-lg font-semibold text-white mt-4">Шаг 2: Настройка плейсхолдеров (текст и ссылки)</h4>
            <p>Плейсхолдеры — это метки в вашем коде, которые можно легко заменить на нужные данные. Используйте их для информации, которая может меняться: заголовки, контактные данные, и, что особенно удобно, — ссылки между страницами.</p>
            <p><strong>Формат:</strong> Плейсхолдеры должны быть в формате <code>[[ что-то ]]</code> или <code>{`{{ что-то }}`}</code>.</p>
            
            <p className="font-semibold mt-3">Два типа плейсхолдеров:</p>
            <ul className="list-disc list-inside space-y-1">
                <li><strong>Текстовые плейсхолдеры:</strong> Любые названия, например <code>{`{{ user_name }}`}</code> или <code>[[ email_address ]]</code>.</li>
                <li><strong>Плейсхолдеры для ссылок:</strong> Название должно начинаться с префикса <code>link_</code> или <code>url_</code>. Например, <code>{`{{ link_to_contacts }}`}</code> или <code>[[ url_about_page ]]</code>.</li>
            </ul>

            <p className="font-semibold mt-3">Как настроить:</p>
            <ol className="list-decimal list-inside space-y-2">
                <li><strong>Выберите страницу:</strong> Нажмите на карточку HTML-файла, который хотите настроить.</li>
                <li><strong>Заполните поля:</strong> В правой панели "Настройки страницы" появятся два раздела:
                    <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                        <li><strong>Текстовые поля:</strong> Введите нужные значения в текстовые поля.</li>
                        <li><strong>Ссылки на страницы:</strong> Для каждого плейсхолдера-ссылки появится выпадающий список. Просто выберите из него страницу, на которую должна вести ссылка.</li>
                    </ul>
                </li>
                <li><strong>Смотрите в реальном времени:</strong> Предпросмотр страницы в карточке будет автоматически обновляться по мере ввода данных!</li>
            </ol>
            <p className="mt-2 p-2 bg-blue-900/50 text-blue-300 rounded-md border border-blue-800 text-sm"><strong>Главное преимущество:</strong> если вы воспользуетесь функцией "Оптимизировать имена", все ссылки, созданные через плейсхолдеры, автоматически обновятся и будут указывать на новые, правильные имена файлов!</p>


            <h4 className="text-lg font-semibold text-white mt-4">Шаг 3: Выбор главной страницы</h4>
            <p>Каждый сайт должен иметь главную страницу, которая открывается по умолчанию. Обычно это файл <code>index.html</code>.</p>
            <ol className="list-decimal list-inside space-y-2">
                <li>Найдите карточку страницы, которую вы хотите сделать главной.</li>
                <li>Нажмите на кнопку <strong>"Сделать главной"</strong> со звездочкой.</li>
                <li>Кнопка изменит цвет, а имя файла автоматически установится на <code>index.html</code>. Эта страница станет точкой входа на ваш сайт.</li>
            </ol>
            <p className="mt-2 p-2 bg-yellow-900/50 text-yellow-300 rounded-md border border-yellow-800 text-sm"><strong>Важно:</strong> Вы должны выбрать главную страницу, чтобы кнопка упаковки стала активной.</p>

             <h4 className="text-lg font-semibold text-white mt-4">Шаг 4: Добавление аналитики (необязательно)</h4>
            <p>В правой панели вы найдете раздел <strong>"Глобальные скрипты"</strong>. Вставьте сюда код от Яндекс.Метрики, Google Analytics или другого сервиса. Этот код будет автоматически добавлен на все ваши HTML-страницы перед упаковкой.</p>
            
            <h4 className="text-lg font-semibold text-white mt-4">Шаг 5: Оптимизация имен файлов (необязательно)</h4>
            <p>Это очень полезный шаг для улучшения SEO.</p>
             <ol className="list-decimal list-inside space-y-2">
                <li><strong>Нажмите кнопку:</strong> В правой панели нажмите <strong>"Оптимизировать имена"</strong>.</li>
                <li><strong>Введите API-ключ:</strong> При первом использовании приложение попросит вас ввести <strong>API-ключ от Google Gemini</strong>.
                    <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                        <li>Вы можете бесплатно получить его в <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Google AI Studio</a>.</li>
                        <li>Ключ надежно сохранится в вашем браузере для будущего использования.</li>
                    </ul>
                </li>
                 <li><strong>Готово:</strong> ИИ проанализирует содержимое каждой страницы (кроме главной) и переименует файлы, используя понятные слова в <code>kebab-case</code> (например, <code>kontaktnaya-informaciya.html</code>).</li>
            </ol>
            
            <h4 className="text-lg font-semibold text-white mt-4">Шаг 6: Упаковка и скачивание</h4>
            <p>Когда все настроено, осталось только упаковать сайт.</p>
            <ol className="list-decimal list-inside space-y-2">
                <li>Нажмите кнопку <strong>"Подготовить для GitHub"</strong> (она также подходит для Vercel и других хостингов).</li>
                <li>Приложение выполнит всю магию:
                     <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                        <li>Заменит плейсхолдеры вашими данными.</li>
                        <li>Добавит глобальные скрипты (если вы их указали).</li>
                        <li>Переименует файлы согласно вашим настройкам.</li>
                        <li>Автоматически обновит все внутренние ссылки (<code>&lt;a href="..."&gt;</code>, <code>&lt;img src="..."&gt;</code>), включая созданные через плейсхолдеры.</li>
                        <li>Создаст ZIP-архив <code>deploy.zip</code> и предложит его скачать.</li>
                    </ul>
                </li>
            </ol>

            <h4 className="text-lg font-semibold text-white mt-4">Шаг 7: Публикация сайта</h4>
            <p>Внутри скачанного архива вы найдете файл <code>README.md</code> с подробными инструкциями по развертыванию вашего сайта на <strong>GitHub Pages</strong> или <strong>Vercel</strong>. Просто следуйте им, и ваш сайт будет онлайн!</p>
            <p>Если вы захотите начать сначала, в любой момент можно нажать кнопку <strong>"Начать заново"</strong>.</p>
        </section>
    </div>
);
