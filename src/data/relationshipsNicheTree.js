/** @typedef {{ id: string, label: string, children?: NicheNode[] }} NicheNode */

/** @param {string} id @param {string} label @param {NicheNode[]} [children] @returns {NicheNode} */
function node(id, label, children) {
  return children?.length ? { id, label, children } : { id, label };
}

/** @type {NicheNode} */
export const RELATIONSHIPS_NICHE_ROOT = {
  id: 'relationships',
  label: 'Relationships',
  children: [
    node('relationships-romantic', 'Romantic Relationships', [
      node('relationships-romantic-dating', 'Dating', [
        node('relationships-romantic-dating-online', 'Online Dating', [
          node(
            'relationships-romantic-dating-online-introverts',
            'Dating for Introverted Professionals'
          ),
          node(
            'relationships-romantic-dating-online-lgbtq',
            'Dating for LGBTQ+ Individuals'
          )
        ]),
        node('relationships-romantic-dating-speed', 'Speed Dating', [
          node(
            'relationships-romantic-dating-speed-busy',
            'Speed Dating for Busy Professionals'
          ),
          node(
            'relationships-romantic-dating-speed-divorcees',
            'Speed Dating for Divorcees'
          )
        ])
      ]),
      node('relationships-romantic-coaching', 'Relationship Coaching', [
        node('relationships-romantic-coaching-marriage', 'Marriage Coaching', [
          node(
            'relationships-romantic-coaching-marriage-newlyweds',
            'Coaching for Newlyweds'
          ),
          node(
            'relationships-romantic-coaching-marriage-kids',
            'Coaching for Couples with Kids'
          )
        ]),
        node('relationships-romantic-coaching-breakup', 'Breakup Recovery', [
          node(
            'relationships-romantic-coaching-breakup-men',
            'Breakup Coaching for Men'
          ),
          node(
            'relationships-romantic-coaching-breakup-women',
            'Breakup Support for Middle-Aged Women'
          )
        ])
      ])
    ]),
    node('relationships-family', 'Family Relationships', [
      node('relationships-family-parenting', 'Parenting', [
        node('relationships-family-parenting-single', 'Single Parenting', [
          node(
            'relationships-family-parenting-single-dads',
            'Parenting Tips for Single Dads'
          ),
          node(
            'relationships-family-parenting-single-moms',
            'Single Parent Support for Moms'
          )
        ]),
        node('relationships-family-parenting-coparent', 'Co-Parenting', [
          node(
            'relationships-family-parenting-coparent-divorced',
            'Co-Parenting Strategies for Divorced Couples'
          ),
          node(
            'relationships-family-parenting-coparent-international',
            'Co-Parenting for International Families'
          )
        ])
      ]),
      node('relationships-family-sibling', 'Sibling Relationships', [
        node(
          'relationships-family-sibling-rivalry',
          'Sibling Rivalry Management'
        ),
        node(
          'relationships-family-sibling-bond-adults',
          'Sibling Bond Strengthening for Adults'
        )
      ])
    ]),
    node('relationships-friendships', 'Friendships and Social Connections', [
      node('relationships-friendships-building', 'Building Friendships', [
        node(
          'relationships-friendships-building-new-moms',
          'Friendship Building for New Moms'
        ),
        node(
          'relationships-friendships-building-nomads',
          'Friendship Support for Digital Nomads'
        )
      ]),
      node('relationships-friendships-networking', 'Networking', [
        node(
          'relationships-friendships-networking-women-tech',
          'Professional Networking for Women in Tech'
        ),
        node(
          'relationships-friendships-networking-entrepreneurs',
          'Networking Strategies for Entrepreneurs'
        )
      ]),
      node('relationships-friendships-social-skills', 'Social Skills', [
        node(
          'relationships-friendships-social-skills-introverts',
          'Social Skills Training for Introverts'
        ),
        node(
          'relationships-friendships-social-skills-teens',
          'Social Confidence Building for Teens'
        )
      ])
    ]),
    node('relationships-workplace', 'Workplace Relationships', [
      node('relationships-workplace-team', 'Team Building', [
        node(
          'relationships-workplace-team-remote',
          'Team Building Activities for Remote Teams'
        ),
        node(
          'relationships-workplace-team-corporate',
          'Team Bonding for Corporate Employees'
        )
      ]),
      node('relationships-workplace-conflict', 'Conflict Resolution', [
        node(
          'relationships-workplace-conflict-small-biz',
          'Conflict Resolution for Small Businesses'
        ),
        node(
          'relationships-workplace-conflict-corporate',
          'Workplace Mediation for Corporate Teams'
        )
      ]),
      node('relationships-workplace-engagement', 'Employee Engagement', [
        node(
          'relationships-workplace-engagement-startups',
          'Engagement Strategies for Tech Startups'
        ),
        node(
          'relationships-workplace-engagement-enterprise',
          'Employee Recognition Programs for Large Corporations'
        )
      ])
    ]),
    node('relationships-community', 'Community and Group Relationships', [
      node('relationships-community-support', 'Support Groups', [
        node(
          'relationships-community-support-cancer',
          'Support Groups for Cancer Survivors'
        ),
        node(
          'relationships-community-support-special-needs',
          'Support Groups for Parents of Children with Special Needs'
        )
      ]),
      node('relationships-community-volunteering', 'Volunteering and Community Service', [
        node(
          'relationships-community-volunteering-retirees',
          'Volunteering Opportunities for Retirees'
        ),
        node(
          'relationships-community-volunteering-high-school',
          'Community Service Programs for High School Students'
        )
      ]),
      node('relationships-community-hobbies', 'Group Hobbies and Interests', [
        node(
          'relationships-community-hobbies-hiking',
          'Group Hiking for Adventure Enthusiasts'
        ),
        node(
          'relationships-community-hobbies-book-clubs',
          'Book Clubs for Personal Development Enthusiasts'
        )
      ])
    ]),
    node('relationships-parenting-support', 'Parenting Support', [
      node('relationships-parenting-support-education', 'Parenting Education', [
        node(
          'relationships-parenting-support-education-fathers',
          'Parenting Skills for New Fathers'
        ),
        node(
          'relationships-parenting-support-education-teens',
          'Positive Parenting Strategies for Teenagers'
        )
      ]),
      node('relationships-parenting-support-special-needs', 'Special Needs Parenting', [
        node('relationships-parenting-support-autism', 'Autism Parenting Support', [
          node(
            'relationships-parenting-support-autism-coaching',
            'Coaching for Parents of Children with Autism'
          ),
          node(
            'relationships-parenting-support-autism-siblings',
            'Autism Support for Siblings'
          )
        ]),
        node('relationships-parenting-support-adhd', 'ADHD Parenting', [
          node(
            'relationships-parenting-support-adhd-school',
            'ADHD Parenting Coaching for School-Age Children'
          ),
          node(
            'relationships-parenting-support-adhd-teens',
            'ADHD Support for Teenagers'
          )
        ])
      ])
    ]),
    node('relationships-personal-dev', 'Personal Development in Relationships', [
      node('relationships-personal-dev-eq', 'Emotional Intelligence', [
        node(
          'relationships-personal-dev-eq-leaders',
          'Emotional Intelligence Training for Leaders'
        ),
        node(
          'relationships-personal-dev-eq-teens',
          'Emotional Intelligence Coaching for Teenagers'
        )
      ]),
      node('relationships-personal-dev-conflict', 'Conflict Management', [
        node(
          'relationships-personal-dev-conflict-couples',
          'Conflict Management for Couples'
        ),
        node(
          'relationships-personal-dev-conflict-college',
          'Conflict Resolution Skills for College Students'
        )
      ]),
      node('relationships-personal-dev-communication', 'Communication Skills', [
        node(
          'relationships-personal-dev-communication-couples',
          'Communication Coaching for Couples'
        ),
        node(
          'relationships-personal-dev-communication-women',
          'Assertiveness Training for Women in Relationships'
        )
      ])
    ]),
    node('relationships-digital', 'Digital Relationships', [
      node('relationships-digital-friendships', 'Online Friendships', [
        node(
          'relationships-digital-friendships-remote',
          'Friendship Building for Remote Workers'
        ),
        node(
          'relationships-digital-friendships-seniors',
          'Virtual Friendship Support for Isolated Seniors'
        )
      ]),
      node('relationships-digital-social-media', 'Social Media Influence', [
        node(
          'relationships-digital-social-media-brand',
          'Building Personal Brand Relationships on Social Media'
        ),
        node(
          'relationships-digital-social-media-entrepreneurs',
          'Social Media Networking for Entrepreneurs'
        )
      ]),
      node('relationships-digital-etiquette', 'Digital Etiquette', [
        node(
          'relationships-digital-etiquette-teens',
          'Digital Communication Skills for Teens'
        ),
        node(
          'relationships-digital-etiquette-corporate',
          'Digital Etiquette Training for Corporate Employees'
        )
      ])
    ])
  ]
};
