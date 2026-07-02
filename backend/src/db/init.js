const db = require('./database');

async function initializeDatabase() {
    if (db.client.config.client === 'sqlite3') {
        await db.raw('PRAGMA foreign_keys = ON');
    }

  // Companies
  if (!(await db.schema.hasTable('companies'))) {
    await db.schema.createTable('companies', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('website').defaultTo('');
      t.string('industry').defaultTo('IT');
      t.string('city').defaultTo('');
      t.string('status').defaultTo('pending');
      t.text('notes').defaultTo('');
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    });
  }

  // Contacts
  if (!(await db.schema.hasTable('contacts'))) {
    await db.schema.createTable('contacts', t => {
      t.increments('id').primary();
      t.integer('company_id').references('id').inTable('companies').onDelete('CASCADE');
      t.string('email').notNullable();
      t.string('name').defaultTo('');
      t.string('role').defaultTo('');
      t.string('phone').defaultTo('');
      t.integer('score').defaultTo(50);
      t.string('source_url').defaultTo('');
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
  }

  // Add phone column if it doesn't exist (for existing DBs)
  const hasPhone = await db.schema.hasColumn('contacts', 'phone');
  if (!hasPhone) {
    await db.schema.table('contacts', t => { t.string('phone').defaultTo(''); });
  }

  // Campaigns
  if (!(await db.schema.hasTable('campaigns'))) {
    await db.schema.createTable('campaigns', t => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('subject').notNullable();
      t.text('template_content').defaultTo('');
      t.string('template_path').defaultTo('');
      t.string('resume_path').defaultTo('');
      t.string('position').defaultTo('Software Developer');
      t.string('status').defaultTo('draft');
      t.timestamp('created_at').defaultTo(db.fn.now());
      t.timestamp('updated_at').defaultTo(db.fn.now());
    });
  }

  // Email logs
  if (!(await db.schema.hasTable('email_logs'))) {
    await db.schema.createTable('email_logs', t => {
      t.increments('id').primary();
      t.integer('campaign_id').references('id').inTable('campaigns');
      t.integer('contact_id').references('id').inTable('contacts');
      t.integer('company_id').references('id').inTable('companies');
      t.string('recipient_email').notNullable();
      t.string('recipient_name').defaultTo('');
      t.string('company_name').defaultTo('');
      t.string('subject').defaultTo('');
      t.string('status').defaultTo('pending');
      t.timestamp('sent_at');
      t.text('error_msg');
      t.string('gmail_message_id').defaultTo('');
    });
  }

  // Settings
  if (!(await db.schema.hasTable('settings'))) {
    await db.schema.createTable('settings', t => {
      t.string('key').primary();
      t.text('value');
    });
  }

  // Gmail Accounts (multi-account support)
  if (!(await db.schema.hasTable('gmail_accounts'))) {
    await db.schema.createTable('gmail_accounts', t => {
      t.increments('id').primary();
      t.string('email').notNullable();
      t.string('label').defaultTo('');
      t.text('credentials_json').notNullable();
      t.text('token_json').defaultTo('');
      t.boolean('is_active').defaultTo(false);
      t.timestamp('connected_at').defaultTo(db.fn.now());
    });
  }

  // Discover History
  if (!(await db.schema.hasTable('discover_history'))) {
    await db.schema.createTable('discover_history', t => {
      t.increments('id').primary();
      t.string('query').notNullable();
      t.integer('result_count').defaultTo(0);
      t.text('results_json').defaultTo('[]');
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
  }

  // Default settings
  const defaults = [
    { key: 'sender_email', value: 'surajorg47@gmail.com' },
    { key: 'test_email', value: 'surajorg48@gmail.com' },
    { key: 'send_delay_ms', value: '15000' },
    { key: 'resume_path', value: '../Suraj_Choudhari_Resume.pdf' },
    { key: 'template_path', value: '../templates/email_template.md' },
    { key: 'gmail_connected', value: 'false' },
    { key: 'applicant_name', value: 'Suraj Choudhari' },
    { key: 'applicant_phone', value: '' },
    { key: 'applicant_linkedin', value: '' },
    { key: 'applicant_github', value: '' },
    { key: 'active_gmail_account', value: '' },
  ];

  for (const d of defaults) {
    const exists = await db('settings').where('key', d.key).first();
    if (!exists) await db('settings').insert(d);
  }

  console.log('✅ Database initialized successfully');
}

module.exports = { initializeDatabase };
