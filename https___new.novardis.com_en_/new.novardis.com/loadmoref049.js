jQuery(function($){
    $('#loadmore').click(function(){ // клик на кнопку
        // получаем нужные переменные
        var data = {
            'action': 'loadmore',
            'query': posts_vars,
            'post_type': post_type,
            'lang': lang_now,
            'page' : current_page
        };
        if(lang_now == 'ru'){
            $(this).text('Загрузка...'); // меняем текст на кнопке
        }
        else {
            $(this).text('Loading...');
        }
        // отправляем Ajax запрос 
        $.ajax({
            url:ajaxurl,
            data:data,
            type:'POST',
            success:function(data){
                if(data) {
                    if(lang_now == 'ru'){
                        $('#loadmore').text('Показать больше');
                    }
                    else {
                        $('#loadmore').text('Show more');
                    }
                    $('#listcontent').append(data); // добавляем новые посты
                    current_page++; // записываем новый номер страницы

                    itemActive = $('.pagination .current.active span').text();
                    $('.pagination .current.active').html('<a href="?pag='+itemActive+'">'+itemActive+'</a>');
                    $('.pagination .current.active').removeClass('current');
                    $('.pagination .active').removeClass('active');
                    $('.pagination').find('li[data-page="'+current_page+'"]').addClass('current');
                    $('.pagination').find('li[data-page="'+current_page+'"]').addClass('active');
                    $('.pagination').find('li[data-page="'+current_page+'"]').html('<span>'+current_page+'</span>');
                    history.pushState('data', '', window.location.href.split('?')[0]+'?pag='+current_page);
                    if (current_page == max_pages) {
                        $("#loadmore").remove();
                    }
                } else {
                    $('#loadmore').remove();
                }
            }
        });
    });
});