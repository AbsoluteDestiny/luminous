const fs = require("fs");
const path = require("path");
const Metalsmith = require("metalsmith");
const markdown = require("metalsmith-markdown");
const layouts = require("metalsmith-layouts");
const inplace = require("metalsmith-in-place");
const permalinks = require("metalsmith-permalinks");
const collections = require("metalsmith-collections");
// const metadata = require("metalsmith-metadata");
const nunjucks = require("nunjucks");
const paths = require("metalsmith-paths");
const less = require("metalsmith-less");
const autoprefixer = require("metalsmith-autoprefixer");
// const metacopy = require("metalsmith-metacopy");
const copy = require("metalsmith-copy");
// const pagination = require("metalsmith-pagination");
// const jsonToFiles = require("metalsmith-json-to-files");
const htmlMinifier = require("metalsmith-html-minifier");
const ignore = require("metalsmith-ignore");
const each = require("metalsmith-each");
const filesize = require("filesize");
// const watch = require("metalsmith-watch");
const frontmatter = require("front-matter");
const fingerprint = require("metalsmith-fingerprint-ignore");
const subsetfonts = require("metalsmith-subsetfonts");
const sitemap = require("metalsmith-sitemap");
const feed = require("metalsmith-feed");
const fileMetadata = require("metalsmith-filemetadata");
// const tags = require("metalsmith-tags");
const replace = require("metalsmith-text-replace");

const sitedata = frontmatter(fs.readFileSync("./src/data/config.md", "utf8"))
  .attributes;

let nextId = 0;

if (fs.existsSync("./lumvids.json")) {
  const lumvids = require("./lumvids.json");

  let files = fs
    .readdirSync("F:\\lum\\encodes")
    .filter(f => f.indexOf(".m4v") > -1);
  const vids = Object.keys(lumvids).map((v) => {
    const vid = lumvids[v];
    let mp4 = files.filter(f => f.indexOf(`-${v.split("-")[0]}-`) > -1);
    let mp4size = 0;
    if (mp4.length) {
      mp4size = fs.statSync(path.join("F:\\lum\\encodes", mp4[0])).size;
    }
    return {
      key: v,
      title: vid.title,
      vidder: vid.vidder,
      description: vid.description,
      date_made: vid.date_made,
      song: vid.song,
      artist: vid.artist,
      width: vid.width,
      height: vid.height,
      fandoms: vid.fandoms,
      mp4: mp4 ? mp4[0] : null,
      mp4size: filesize(mp4size)
    };
  });

  for (vid of vids.filter(v => v.mp4)) {
    const vidTemplate = `---
vid_id: ${vid.key.split("-")[0]}
title: ${vid.title}
fandoms:${vid.fandoms
      ? "\n" + vid.fandoms.map(f => "    - " + f).join("\n")
      : ""}
creators: ${vid.vidder}
song: ${vid.song}
artist: ${vid.artist}
date:   ${vid.date_made}
thumbnail: ${vid.mp4
      ? encodeURIComponent(vid.mp4.replace(".m4v", ".jpg"))
      : null}
barcode: ${vid.mp4 ? encodeURIComponent(vid.mp4.replace(".m4v", ".png")) : null}
mp4name: ${vid.mp4 ? vid.mp4 : null}
mp4size: ${vid.mp4 ? vid.mp4size : null}
width: ${vid.width}
height: ${vid.height}
---

${vid.description}
  `;
    fs.writeFileSync(`./src/vids/${vid.key}.md`, vidTemplate);
  }
}

nunjucks.configure("./layouts", { watch: false, noCache: true });

function fandoms(options) {
  return function(files, metalsmith, done) {
    let fandoms = [];
    Object.keys(files)
      .filter(f => path.extname(f) === ".md")
      .forEach(function(file) {
        const fm = frontmatter(
          fs.readFileSync(path.join(metalsmith._source, file), "utf8")
        );
        nextId = Number.isNaN(Number(fm.attributes.vid_id))
          ? nextId
          : Number(fm.attributes.vid_id);
        if (fm.attributes.fandoms) {
          const fandoms = fm.attributes.fandoms.toString().split(", ");
          for (fandom of fandoms) {
            if (fandoms.indexOf(fandom) < 0) {
              fandoms.push(fandom);
            }
          }
        }
      });
    fandoms.sort();
    metalsmith._metadata.tags = fandoms;
    setImmediate(done);
  };
}

Metalsmith(process.cwd())
  .metadata({
    site: sitedata
  })
  .source("./src")
  .destination("./build")
  .clean(true)
  .use(less())
  .use(autoprefixer())
  .use(
    copy({
      pattern: "assets/css/*.css",
      move: false,
      transform: function(file) {
        return path.join(
          ...path
            .dirname(file)
            .split(path.sep)
            .slice(1),
          "admin",
          path.basename(file)
        );
      }
    })
  )
  .use(
    copy({
      pattern: "assets/**/*.*",
      move: true,
      transform: function(file) {
        return path.join(
          ...path
            .dirname(file)
            .split(path.sep)
            .slice(1),
          path.basename(file)
        );
      }
    })
  )
  .use(fingerprint({ pattern: ["css/*.css", "js/*.css"] }))
  .use(
    copy({
      pattern: "css/admin/*.*",
      move: true,
      transform: function(file) {
        return path.join("css", path.basename(file));
      }
    })
  )
  .use(fandoms())
  .use(
    replace({
      "admin/config.yml": {
        find: /abcd/gi,
        replace: () => `${nextId + 1}`
      }
    })
  )
  .use(
    each((file, filename) => {
      file.basename = path.basename(filename, ".md");
      return filename;
    })
  )
  .use(ignore(["tags/**", "**/*.less"]))
  .use(
    copy({
      pattern: "vids/*.*",
      move: false,
      transform: function(file) {
        const newpath = path.join(
          "vidplayer",
          ...path
            .dirname(file)
            .split(path.sep)
            .slice(1),
          path.basename(file)
        );
        return newpath;
      }
    })
  )
  .use(
    fileMetadata([
      { pattern: "vids/**", metadata: { layout: "vid.html" } },
      { pattern: "vidplayer/**", metadata: { layout: "twitterplayer.html" } }
    ])
  )
  .use(
    collections({
      vids: {
        pattern: "vids/*.md",
        sortBy: "date",
        reverse: true
      },
      vidplayer: {
        pattern: "vidplayer/*.md",
        sortBy: "date",
        reverse: true
      }
    })
  )
  .use(markdown())
  .use(
    permalinks({
      pattern: "post/:date/:title",
      date: "YYYY/MM/DD",

      linksets: [
        {
          match: { collection: "vids" },
          pattern: "vid/:basename"
        },
        {
          match: { collection: "vidplayer" },
          pattern: "vidplayer/:basename"
        }
      ]
    })
  )
  .use(
    feed({
      collection: "vids"
    })
  )
  .use(paths({ property: "paths" }))
  .use(
    layouts({
      engine: "nunjucks",
      pattern: "**/*.html**"
    })
  )
  .use(
    inplace({
      pattern: "**/*.html.**"
    })
  )
  .use(subsetfonts())
  .use(
    htmlMinifier({
      removeAttributeQuotes: false,
      removeEmptyAttributes: false
    })
  )
  .use(
    sitemap({
      hostname: sitedata.url,
      omitIndex: true
    })
  )
  .build(function(err, files) {
    if (err) {
      throw err;
    }
  });
