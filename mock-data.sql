-- Mock feedback data - simplified for D1
-- Discord feedback
INSERT INTO feedback (source, message, sentiment, author) VALUES
('Discord', 'The new update is incredible! Performance has improved so much.', 'positive', 'TechEnthusiast#1234'),
('Discord', 'Anyone else experiencing crashes on the latest version?', 'negative', 'FrustratedUser#5678'),
('Discord', 'Just tried the beta features. Pretty standard, nothing groundbreaking.', 'neutral', 'CasualGamer#9012'),
('Discord', 'Support team responded within minutes! Best customer service ever!', 'positive', 'HappyCustomer#3456'),
('Discord', 'The UI is confusing and unintuitive. Needs a complete redesign.', 'negative', 'DesignCritic#7890'),
('Discord', 'Thanks for the quick fix on that bug!', 'positive', 'DevUser#2468');

-- Support Tickets
INSERT INTO feedback (source, message, sentiment, author) VALUES
('Support', 'I cannot access my account after the update. This is unacceptable.', 'negative', 'angry.customer@email.com'),
('Support', 'Thank you for resolving my issue so quickly! Very impressed.', 'positive', 'satisfied.user@email.com'),
('Support', 'The documentation helped me solve the problem myself.', 'positive', 'self.helper@email.com'),
('Support', 'Still waiting for a response to my ticket from 3 days ago.', 'negative', 'waiting.user@email.com'),
('Support', 'The new feature works as described. No issues to report.', 'neutral', 'regular.user@email.com'),
('Support', 'Your team went above and beyond to help me. Outstanding service!', 'positive', 'grateful.customer@email.com');

-- GitHub Issues
INSERT INTO feedback (source, message, sentiment, author) VALUES
('GitHub', 'Found a critical security vulnerability in the authentication module.', 'negative', 'security-researcher'),
('GitHub', 'Great PR! This will significantly improve performance.', 'positive', 'contributor-dev'),
('GitHub', 'Documentation needs to be updated for the new API endpoints.', 'neutral', 'docs-maintainer'),
('GitHub', 'This feature request would be a game-changer for our use case!', 'positive', 'enterprise-user'),
('GitHub', 'The build is failing on Windows. Please investigate ASAP.', 'negative', 'windows-dev'),
('GitHub', 'Thanks for merging my PR! Excited to see this in the next release.', 'positive', 'open-source-contributor'),
('GitHub', 'Unit tests are passing but integration tests need work.', 'neutral', 'qa-engineer');

-- Reddit feedback
INSERT INTO feedback (source, message, sentiment, author) VALUES
('Reddit', 'This is hands down the best tool in its category. Highly recommend!', 'positive', 'u/PowerUser2024'),
('Reddit', 'Tried it for a week. Meh. Nothing special compared to competitors.', 'neutral', 'u/SkepticalReviewer'),
('Reddit', 'Constant bugs and terrible performance. Complete waste of money.', 'negative', 'u/DisappointedBuyer'),
('Reddit', 'The community is super helpful and the devs actually listen to feedback!', 'positive', 'u/CommunityMember'),
('Reddit', 'Works fine for basic use cases but lacks advanced features.', 'neutral', 'u/CasualUser99'),
('Reddit', 'Just switched from a competitor and this is SO much better!', 'positive', 'u/NewConvert');

-- X (Twitter) feedback
INSERT INTO feedback (source, message, sentiment, author) VALUES
('X', 'Absolutely loving the new features! You guys crushed it!', 'positive', '@TechInfluencer'),
('X', 'Your customer support is non-existent. Been waiting for help for days.', 'negative', '@FrustratedCustomer'),
('X', 'Just tried the free tier. It is okay, might upgrade later.', 'neutral', '@TrialUser'),
('X', 'Best investment I made this year! Productivity through the roof!', 'positive', '@ProductivityGuru'),
('X', 'The pricing is way too high for what you get. Not worth it.', 'negative', '@BudgetConscious'),
('X', 'Solid product. Does what it promises. No complaints.', 'neutral', '@HonestReviewer'),
('X', 'Your team responsiveness is amazing! Fixed my issue in minutes!', 'positive', '@HappyUser');

-- Email feedback
INSERT INTO feedback (source, message, sentiment, author) VALUES
('Email', 'I am very disappointed with the recent changes. They have made the product worse.', 'negative', 'longterm.customer@company.com'),
('Email', 'Excellent webinar yesterday! Learned so much about the advanced features.', 'positive', 'webinar.attendee@startup.com'),
('Email', 'The migration process was smooth. Everything works as expected.', 'neutral', 'it.admin@enterprise.com'),
('Email', 'Your product has transformed how our team collaborates. Thank you!', 'positive', 'team.lead@agency.com'),
('Email', 'The lack of offline mode is a major drawback for our use case.', 'negative', 'field.worker@construction.com'),
('Email', 'Renewal was straightforward. No issues with billing.', 'neutral', 'finance.dept@corporation.com'),
('Email', 'The training materials you provided were incredibly helpful!', 'positive', 'new.user@nonprofit.org'),
('Email', 'Integration with our existing tools is broken. Please fix urgently.', 'negative', 'sys.admin@tech.company');
