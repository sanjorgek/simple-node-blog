exports.Settings = db.define('settings', {
  key: Sequelize.STRING,
  name: Sequelize.STRING,
  type: Sequelize.STRING,
  s_short: Sequelize.STRING,
  s_long: Sequelize.TEXT,
  flag: Sequelize.BOOLEAN
}, {
  timestamps: false,
  freezeTableName: true
});

exports.Tags = db.define('tags', {
  name: Sequelize.STRING,
  exclude: Sequelize.BOOLEAN
}, {
  timestamps: false,
  freezeTableName: true
});

exports.Blog = db.define('blog', {
  visible: Sequelize.BOOLEAN,
  header: Sequelize.STRING,
  text: Sequelize.TEXT,
  comments_cnt: Sequelize.INTEGER,
  post_date: Sequelize.DATE
}, {
  timestamps: false,
  freezeTableName: true
});

exports.BlogTags = db.define('blog_tags', {
  blog_id: Sequelize.INTEGER,
  tag_id: Sequelize.INTEGER
}, {
  timestamps: false,
  freezeTableName: true
});

exports.Sessions = db.define('sessions', {
  sid: {
    type: Sequelize.STRING,
    primaryKey: true
  },
  data: Sequelize.TEXT
});
