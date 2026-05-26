/** @typedef {{ id: string, label: string, children?: NicheNode[] }} NicheNode */

/** @param {string} id @param {string} label @param {NicheNode[]} [children] @returns {NicheNode} */
function node(id, label, children) {
  return children?.length ? { id, label, children } : { id, label };
}

/** @type {NicheNode} */
export const WEALTH_NICHE_ROOT = {
  id: 'wealth',
  label: 'Wealth',
  children: [
    node('wealth-investing', 'Investing', [
      node('wealth-investing-realestate', 'Real Estate Investing', [
        node('wealth-investing-realestate-residential', 'Residential Real Estate', [
          node(
            'wealth-investing-realestate-residential-first-time',
            'Real Estate for First-Time Homebuyers'
          ),
          node(
            'wealth-investing-realestate-residential-single-parents',
            'Real Estate Investing for Single Parents'
          )
        ]),
        node('wealth-investing-realestate-commercial', 'Commercial Real Estate', [
          node(
            'wealth-investing-realestate-commercial-small-biz',
            'Commercial Real Estate for Small Business Owners'
          )
        ])
      ]),
      node('wealth-investing-stocks', 'Stock Market Investing', [
        node('wealth-investing-stocks-dividend', 'Dividend Investing', [
          node(
            'wealth-investing-stocks-dividend-retirees',
            'Dividend Investing for Retirees'
          )
        ]),
        node('wealth-investing-stocks-growth', 'Growth Stock Investing', [
          node(
            'wealth-investing-stocks-growth-young-pros',
            'Stock Investing for Young Professionals'
          ),
          node(
            'wealth-investing-stocks-growth-beginners',
            'Stock Market Education for Beginners'
          )
        ])
      ]),
      node('wealth-investing-crypto', 'Cryptocurrency', [
        node('wealth-investing-crypto-bitcoin', 'Bitcoin Trading', [
          node(
            'wealth-investing-crypto-bitcoin-entrepreneurs',
            'Bitcoin for Entrepreneurs'
          ),
          node(
            'wealth-investing-crypto-bitcoin-freelancers',
            'Bitcoin for Freelancers'
          )
        ]),
        node('wealth-investing-crypto-nft', 'NFT Investments', [
          node(
            'wealth-investing-crypto-nft-art',
            'NFT Collecting for Art Enthusiasts'
          ),
          node(
            'wealth-investing-crypto-nft-gamers',
            'NFT Investing for Gamers'
          )
        ])
      ])
    ]),
    node('wealth-personal-finance', 'Personal Finance', [
      node('wealth-personal-finance-budgeting', 'Budgeting', [
        node(
          'wealth-personal-finance-budgeting-families',
          'Budgeting for Families'
        ),
        node(
          'wealth-personal-finance-budgeting-college',
          'Budgeting for College Students'
        )
      ]),
      node('wealth-personal-finance-debt', 'Debt Management', [
        node(
          'wealth-personal-finance-debt-high-income',
          'Debt Relief for High-Income Professionals'
        ),
        node(
          'wealth-personal-finance-debt-millennials',
          'Debt Consolidation for Millennials'
        )
      ]),
      node('wealth-personal-finance-saving', 'Saving and Emergency Funds', [
        node(
          'wealth-personal-finance-saving-freelancers',
          'Saving Strategies for Freelancers'
        ),
        node(
          'wealth-personal-finance-saving-single-parents',
          'Emergency Fund Building for Single Parents'
        )
      ])
    ]),
    node('wealth-business-dev', 'Business Development', [
      node('wealth-business-dev-online', 'Online Businesses', [
        node('wealth-business-dev-online-ecommerce', 'E-commerce', [
          node(
            'wealth-business-dev-online-ecommerce-craft',
            'E-commerce for Craft Businesses'
          ),
          node(
            'wealth-business-dev-online-ecommerce-fitness',
            'E-commerce for Fitness Trainers'
          )
        ]),
        node('wealth-business-dev-online-dropshipping', 'Dropshipping', [
          node(
            'wealth-business-dev-online-dropshipping-fashion',
            'Dropshipping for Fashion Accessories'
          ),
          node(
            'wealth-business-dev-online-dropshipping-eco',
            'Dropshipping for Eco-Friendly Products'
          )
        ])
      ]),
      node('wealth-business-dev-freelancing', 'Freelancing', [
        node(
          'wealth-business-dev-freelancing-writers',
          'Freelancing for Writers'
        ),
        node(
          'wealth-business-dev-freelancing-designers',
          'Freelancing for Graphic Designers'
        )
      ]),
      node('wealth-business-dev-consulting', 'Consulting', [
        node(
          'wealth-business-dev-consulting-financial-startups',
          'Financial Consulting for Startups'
        ),
        node(
          'wealth-business-dev-consulting-leadership-nonprofits',
          'Leadership Consulting for Nonprofits'
        )
      ])
    ]),
    node('wealth-entrepreneurship', 'Entrepreneurship', [
      node('wealth-entrepreneurship-social', 'Social Entrepreneurship', [
        node(
          'wealth-entrepreneurship-social-sustainability',
          'Social Enterprise for Sustainability'
        ),
        node(
          'wealth-entrepreneurship-social-education',
          'Social Enterprise for Education Access'
        )
      ]),
      node('wealth-entrepreneurship-tech', 'Tech Startups', [
        node(
          'wealth-entrepreneurship-tech-healthcare',
          'Tech Startups for Healthcare Solutions'
        ),
        node(
          'wealth-entrepreneurship-tech-ai-ecommerce',
          'AI-Based Startups for E-commerce'
        )
      ]),
      node('wealth-entrepreneurship-franchise', 'Franchise Ownership', [
        node(
          'wealth-entrepreneurship-franchise-fitness',
          'Franchises in the Fitness Industry'
        ),
        node(
          'wealth-entrepreneurship-franchise-pet-care',
          'Franchises for Pet Care Services'
        )
      ])
    ]),
    node('wealth-career', 'Career Development', [
      node('wealth-career-coaching', 'Career Coaching', [
        node(
          'wealth-career-coaching-mid-level',
          'Career Transition Coaching for Mid-Level Professionals'
        ),
        node(
          'wealth-career-coaching-graduates',
          'Career Coaching for Recent Graduates'
        )
      ]),
      node('wealth-career-skills', 'Skill Development', [
        node(
          'wealth-career-skills-public-speaking',
          'Public Speaking for Executives'
        ),
        node(
          'wealth-career-skills-negotiation-women',
          'Negotiation Skills for Women'
        )
      ]),
      node('wealth-career-leadership', 'Leadership Development', [
        node(
          'wealth-career-leadership-women-stem',
          'Leadership Coaching for Women in STEM'
        ),
        node(
          'wealth-career-leadership-nonprofit',
          'Leadership Development for Nonprofit Leaders'
        )
      ])
    ]),
    node('wealth-passive-income', 'Passive Income', [
      node('wealth-passive-income-rental', 'Rental Properties', [
        node(
          'wealth-passive-income-rental-vacation-families',
          'Vacation Rental Properties for Families'
        ),
        node(
          'wealth-passive-income-rental-college-towns',
          'Long-Term Rentals in College Towns'
        )
      ]),
      node('wealth-passive-income-digital', 'Digital Products', [
        node(
          'wealth-passive-income-digital-courses-educators',
          'Creating Online Courses for Educators'
        ),
        node(
          'wealth-passive-income-digital-ebooks-health',
          'Selling E-books for Health Enthusiasts'
        )
      ]),
      node('wealth-passive-income-affiliate', 'Affiliate Marketing', [
        node(
          'wealth-passive-income-affiliate-beauty',
          'Affiliate Marketing for Beauty Bloggers'
        ),
        node(
          'wealth-passive-income-affiliate-travel',
          'Affiliate Marketing for Travel Writers'
        )
      ])
    ]),
    node('wealth-retirement', 'Retirement Planning', [
      node('wealth-retirement-early', 'Early Retirement', [
        node(
          'wealth-retirement-early-tech',
          'Retirement Planning for Tech Workers'
        ),
        node(
          'wealth-retirement-early-firefighters',
          'Early Retirement Strategies for Firefighters'
        )
      ]),
      node('wealth-retirement-pension', 'Pension Planning', [
        node(
          'wealth-retirement-pension-government',
          'Pension Strategies for Government Employees'
        ),
        node(
          'wealth-retirement-pension-military',
          'Pension Management for Military Veterans'
        )
      ]),
      node('wealth-retirement-fi', 'Financial Independence', [
        node(
          'wealth-retirement-fi-freelancers',
          'Financial Independence for Freelancers'
        ),
        node(
          'wealth-retirement-fi-fire-nomads',
          'FIRE (Financial Independence Retire Early) Coaching for Digital Nomads'
        )
      ])
    ]),
    node('wealth-tax', 'Tax Strategies', [
      node('wealth-tax-small-biz', 'Small Business Taxation', [
        node(
          'wealth-tax-small-biz-online',
          'Tax Planning for Online Entrepreneurs'
        ),
        node(
          'wealth-tax-small-biz-multi-income',
          'Tax Strategies for Small Business Owners with Multiple Income Streams'
        )
      ]),
      node('wealth-tax-personal', 'Personal Taxation', [
        node(
          'wealth-tax-personal-high-income',
          'Tax Strategies for High-Income Earners'
        ),
        node(
          'wealth-tax-personal-remote',
          'Tax Planning for Remote Workers'
        )
      ]),
      node('wealth-tax-relief', 'Tax Relief', [
        node(
          'wealth-tax-relief-special-needs',
          'Tax Relief for Families with Special Needs Children'
        ),
        node(
          'wealth-tax-relief-newlyweds',
          'Tax Planning for Newlyweds'
        )
      ])
    ]),
    node('wealth-preservation', 'Wealth Preservation', [
      node('wealth-preservation-estate', 'Estate Planning', [
        node(
          'wealth-preservation-estate-special-needs',
          'Estate Planning for Families with Special Needs Children'
        ),
        node(
          'wealth-preservation-estate-hnw',
          'Estate Planning for High-Net-Worth Individuals'
        )
      ]),
      node('wealth-preservation-asset', 'Asset Protection', [
        node(
          'wealth-preservation-asset-realestate',
          'Asset Protection for Real Estate Investors'
        ),
        node(
          'wealth-preservation-asset-small-biz',
          'Asset Protection for Small Business Owners'
        )
      ]),
      node('wealth-preservation-insurance', 'Insurance Planning', [
        node(
          'wealth-preservation-insurance-young-parents',
          'Life Insurance Strategies for Young Parents'
        ),
        node(
          'wealth-preservation-insurance-entrepreneurs',
          'Insurance Solutions for Entrepreneurs'
        )
      ])
    ])
  ]
};
