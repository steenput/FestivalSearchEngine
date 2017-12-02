const consts = require("./consts");
const use = require("./use");

exports.infos = function(req, res) {
    log.debug("request url", req.url);
    log.debug("request params", req.params);
    let artist = req.params.artist;
    res.type("json");

    if (artist != undefined) {
        artist = use.dia(artist).toLowerCase();

        let infos = {
            name: "",
            description: "",
            type: "",
            country: "",
            disambiguation: "",
            life_span: {
                ended: "",
                begin: "",
                end: ""
            },
            image: "",
            thumb: "",
            facebook: "",
            genres: [],
            id: "",
            images: []
        };

        spotifyApi.clientCredentialsGrant()
        .then(data => {
            spotifyApi.setAccessToken(data.body['access_token']);
            return spotifyApi.searchArtists(artist);
        })
        .then(data => {
            log.debug(spotifyApi.getAccessToken());

            if (data.body.artists.total === 0) {
                return new Promise((resolve, reject) => {
                    reject(true);
                });
            }
            else {
                const spotify_artist = data.body.artists.items[0];
                const spotify_artist_name_search = spotify_artist.name.toLowerCase();
                log.debug(spotify_artist);
    
                infos.name = spotify_artist.name;
                infos.genres = spotify_artist.genres;
                infos.id = spotify_artist.id;
                infos.images = spotify_artist.images;
    
                return axios.all([
                    axios.get(wiki_url, use.wiki_params(spotify_artist_name_search)),
                    axios.get(wiki_url, use.wiki_params(spotify_artist_name_search + "_(band)")),
                    axios.get(wiki_url, use.wiki_params(spotify_artist_name_search + "_(singer)")),
                    axios.get(music_brainz_url + spotify_artist_name_search),
                    axios.get(use.url_bands_in_town(spotify_artist_name_search, "asdf"))
                ]);
            }
        })
        .then(axios.spread((wk, wk_band, wk_singer, mb, bit) => {
            let check_words = function(str) {
                if (str) {
                    str = str.toLowerCase();
                    let test =
                        str.includes("band") ||
                        str.includes("sing") ||
                        str.includes("song");
                    return test;
                }
                return false;
            };
    
            let check_wiki = function(wk) {
                if (wk.data) {
                    if (wk.data.query.pages) {
                        const id = wk.data.query.pageids[0];
                        const wiki = wk.data.query.pages[id];
                        if (check_words(wiki.extract)) {
                            infos.description = wiki.extract;
                        }
                    }
                }
            };

            infos.image = use.is_defined(bit.data.image_url);
            infos.thumb = use.is_defined(bit.data.thumb_url);
            infos.facebook = use.is_defined(bit.data.facebook_page_url);

            if (mb.data) {
                if (mb.data.artists.length >=0) {
                    const mb_artist = mb.data.artists[0];
                    const mb_life_span = mb_artist["life-span"];
                    
                    infos.type = use.is_defined(mb_artist.type);
                    infos.country = use.is_defined(mb_artist.country);
                    infos.disambiguation = use.is_defined(mb_artist.disambiguation);
                    infos.life_span.ended = use.is_defined(mb_life_span.ended);
                    infos.life_span.begin = use.is_defined(mb_life_span.begin);
                    infos.life_span.end = use.is_defined(mb_life_span.end);
                }
            }

            check_wiki(wk);
            check_wiki(wk_band);
            check_wiki(wk_singer);

            log.debug("infos\n", infos);
            res.status(200).end(JSON.stringify({infos: infos}));
        }))
        .catch(error => {
            log.error(error);
            log.error("artist_not_found");
            res.status(404).end(JSON.stringify({artist_not_found: true}));
        });
    }
    else {
        log.error("no_artist_provided");
        res.status(404).end(JSON.stringify({no_artist_provided: true}));
    }
};
