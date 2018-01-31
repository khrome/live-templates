##Example : A User Feed

Let's define some models (we'll assume we've loaded the vars user, feed, offers):

    Templates.model('user', user);
    Templates.model('feed', feed);
    Templates.model('offers', offers);

then let's define a simplistic view, 'feed':

    <header>{{strings.sitename}} : {{strings.tagline}}</header>
    <nav>
        <a href="{{strings.signup}}">{{config.privacy_policy_url}}</a>
        <a href="{{strings.login}}">{{config.terms_of_service_url}}</a>
        <a href="{{strings.products}}">{{config.help_url}}</a>
        <a href="{{strings.mission}}">{{config.about_url}}</a>
    </nav>
    <article id="feed">
        <h1>{{strings.feed}}</h1>
        {{#models "feed"}}
            <div class="feed_item">
                <h2>{{model ":subject"}}</h2>
                <span class="byline">{{model ":name"}} <span>{{model ":role"}}</span></span>
                <p>
                    {{model ":body"}}
                </p>
            </div>
        {{/models}}
    </article>
    <aside id="offers">
        {{#models "offers"}}
            <a href="{{model ":link"}}"><img src="{{model ":image"}}"/></a>
        {{/models}}
    </aside>
    <footer>
        <a href="{{strings.privacy_policy}}">{{config.privacy_policy_url}}</a>
        <a href="{{strings.terms_of_service}}">{{config.terms_of_service_url}}</a>
        <a href="{{strings.help}}">{{config.help_url}}</a>
        <a href="{{strings.about}}">{{config.about_url}}</a>
    </footer>

then let's create an instance of that view (assuming we have a 'strings' var and a 'config var') and attach it to the body:

    var common = {string:strings, config:config};
    var view = Template.createView('feed', common, document.body);
