/** @typedef {{ id: string, label: string, children?: NicheNode[] }} NicheNode */

/** @param {string} id @param {string} label @param {NicheNode[]} [children] @returns {NicheNode} */
function node(id, label, children) {
  return children?.length ? { id, label, children } : { id, label };
}

/** @type {NicheNode} */
export const HEALTH_NICHE_ROOT = {
  id: 'health',
  label: 'Health',
  children: [
    node('health-fitness', 'Fitness', [
      node('health-fitness-strength', 'Strength Training', [
        node('health-fitness-strength-home', 'Home-Based Strength Training', [
          node(
            'health-fitness-strength-home-postpartum',
            'Strength Training for Postpartum Mothers'
          ),
          node(
            'health-fitness-strength-home-seniors',
            'Strength Training for Seniors'
          )
        ]),
        node('health-fitness-strength-bodyweight', 'Bodyweight Strength Training', [
          node(
            'health-fitness-strength-bodyweight-travelers',
            'Bodyweight Training for Travelers'
          ),
          node(
            'health-fitness-strength-bodyweight-military',
            'Bodyweight Training for Military Personnel'
          )
        ])
      ]),
      node('health-fitness-cardio', 'Cardio Fitness', [
        node('health-fitness-cardio-hiit', 'High-Intensity Interval Training (HIIT)', [
          node(
            'health-fitness-cardio-hiit-professionals',
            'HIIT for Busy Professionals'
          ),
          node(
            'health-fitness-cardio-hiit-women-weight-loss',
            'HIIT for Weight Loss in Women'
          )
        ])
      ]),
      node('health-fitness-yoga', 'Yoga', [
        node('health-fitness-yoga-power', 'Power Yoga', [
          node(
            'health-fitness-yoga-power-athletes',
            'Power Yoga for Athletes'
          )
        ]),
        node('health-fitness-yoga-restorative', 'Restorative Yoga', [
          node(
            'health-fitness-yoga-restorative-stress',
            'Restorative Yoga for Stress Relief'
          ),
          node(
            'health-fitness-yoga-restorative-chronic-pain',
            'Restorative Yoga for Chronic Pain Sufferers'
          )
        ])
      ]),
      node('health-fitness-flexibility', 'Flexibility and Mobility', [
        node(
          'health-fitness-flexibility-mobility-athletes',
          'Mobility Training for Athletes'
        ),
        node(
          'health-fitness-flexibility-office',
          'Flexibility Training for Office Workers',
          [
            node(
              'health-fitness-flexibility-office-remote',
              'Flexibility Programs for Remote Workers'
            )
          ]
        )
      ])
    ]),
    node('health-nutrition', 'Nutrition', [
      node('health-nutrition-diet', 'Diet Plans', [
        node('health-nutrition-diet-keto', 'Ketogenic Diet', [
          node('health-nutrition-diet-keto-diabetics', 'Keto for Diabetics'),
          node('health-nutrition-diet-keto-athletes', 'Keto for Athletes')
        ]),
        node('health-nutrition-diet-plant', 'Plant-Based Diets', [
          node(
            'health-nutrition-diet-plant-bodybuilders',
            'Plant-Based Nutrition for Bodybuilders'
          ),
          node(
            'health-nutrition-diet-plant-families',
            'Plant-Based Diet for Families'
          )
        ])
      ]),
      node('health-nutrition-supplements', 'Supplements', [
        node('health-nutrition-supplements-pre', 'Pre-Workout Supplements', [
          node(
            'health-nutrition-supplements-pre-endurance',
            'Supplements for Endurance Athletes'
          ),
          node(
            'health-nutrition-supplements-pre-beginners',
            'Pre-Workout for Beginners'
          )
        ]),
        node('health-nutrition-supplements-health', 'Health Supplements', [
          node(
            'health-nutrition-supplements-health-mens',
            "Supplements for Men's Health"
          ),
          node(
            'health-nutrition-supplements-health-hormonal',
            'Supplements for Hormonal Balance in Women'
          )
        ])
      ])
    ]),
    node('health-mental', 'Mental Health', [
      node('health-mental-stress', 'Stress Management', [
        node('health-mental-stress-mindfulness', 'Mindfulness and Meditation', [
          node(
            'health-mental-stress-mindfulness-corporate',
            'Meditation for Corporate Professionals'
          ),
          node(
            'health-mental-stress-mindfulness-sleep',
            'Meditation for Sleep Improvement'
          )
        ]),
        node('health-mental-stress-relief', 'Stress Relief Techniques', [
          node(
            'health-mental-stress-relief-parents',
            'Stress Relief for Parents'
          ),
          node(
            'health-mental-stress-relief-college',
            'Stress Management for College Students'
          )
        ])
      ]),
      node('health-mental-therapy', 'Therapy and Counseling', [
        node('health-mental-therapy-online', 'Online Therapy', [
          node(
            'health-mental-therapy-online-veterans',
            'Online Therapy for Veterans'
          ),
          node(
            'health-mental-therapy-online-social-anxiety',
            'Online Therapy for Social Anxiety'
          )
        ]),
        node('health-mental-therapy-cbt', 'Cognitive Behavioral Therapy (CBT)', [
          node('health-mental-therapy-cbt-adolescents', 'CBT for Adolescents'),
          node(
            'health-mental-therapy-cbt-ocd',
            'CBT for Obsessive-Compulsive Disorder'
          )
        ])
      ])
    ]),
    node('health-preventative', 'Preventative Health', [
      node('health-preventative-immunity', 'Immunity Boosting', [
        node(
          'health-preventative-immunity-children',
          'Immunity Programs for Children'
        ),
        node(
          'health-preventative-immunity-travelers',
          'Immunity Boosting for Travelers'
        )
      ]),
      node('health-preventative-longevity', 'Longevity and Anti-Aging', [
        node(
          'health-preventative-longevity-women-50',
          'Anti-Aging for Women Over 50'
        ),
        node(
          'health-preventative-longevity-executives',
          'Longevity Coaching for Executives'
        )
      ]),
      node('health-preventative-sleep', 'Sleep Health', [
        node(
          'health-preventative-sleep-athletes',
          'Sleep Optimization for Athletes'
        ),
        node(
          'health-preventative-sleep-entrepreneurs',
          'Sleep Coaching for Busy Entrepreneurs'
        )
      ])
    ]),
    node('health-alternative', 'Alternative Medicine', [
      node('health-alternative-herbal', 'Herbal Medicine', [
        node(
          'health-alternative-herbal-skin',
          'Herbal Remedies for Skin Conditions'
        ),
        node(
          'health-alternative-herbal-digestive',
          'Herbal Medicine for Digestive Health'
        )
      ]),
      node('health-alternative-acupuncture', 'Acupuncture', [
        node(
          'health-alternative-acupuncture-pain',
          'Acupuncture for Chronic Pain Relief'
        ),
        node(
          'health-alternative-acupuncture-fertility',
          'Acupuncture for Fertility Issues'
        )
      ]),
      node('health-alternative-aromatherapy', 'Aromatherapy', [
        node(
          'health-alternative-aromatherapy-anxiety',
          'Aromatherapy for Anxiety Reduction'
        ),
        node(
          'health-alternative-aromatherapy-insomnia',
          'Aromatherapy for Insomnia'
        )
      ])
    ]),
    node('health-pt', 'Physical Therapy and Rehabilitation', [
      node('health-pt-injury', 'Injury Rehabilitation', [
        node(
          'health-pt-injury-post-surgery-athletes',
          'Post-Surgery Rehabilitation for Athletes'
        ),
        node(
          'health-pt-injury-workplace',
          'Rehabilitation for Workplace Injuries'
        )
      ]),
      node('health-pt-chronic-pain', 'Chronic Pain Management', [
        node(
          'health-pt-chronic-pain-arthritis',
          'Pain Management for Arthritis Patients'
        ),
        node(
          'health-pt-chronic-pain-runners',
          'Pain Relief for Long-Distance Runners'
        )
      ]),
      node('health-pt-mobility', 'Mobility Recovery', [
        node(
          'health-pt-mobility-seniors',
          'Mobility Recovery for Seniors'
        ),
        node(
          'health-pt-mobility-car-accidents',
          'Mobility Training After Car Accidents'
        )
      ])
    ]),
    node('health-specialized', 'Specialized Health Services', [
      node('health-specialized-womens', "Women's Health", [
        node('health-specialized-womens-fertility', 'Fertility Counseling', [
          node(
            'health-specialized-womens-fertility-older',
            'Fertility Counseling for Older Women'
          ),
          node(
            'health-specialized-womens-fertility-same-sex',
            'Fertility Counseling for Same-Sex Couples'
          )
        ]),
        node('health-specialized-womens-menopause', 'Menopause Support', [
          node(
            'health-specialized-womens-menopause-professional',
            'Menopause Coaching for Professional Women'
          )
        ])
      ]),
      node('health-specialized-mens', "Men's Health", [
        node('health-specialized-mens-prostate', 'Prostate Health', [
          node(
            'health-specialized-mens-prostate-50',
            'Prostate Care for Men Over 50'
          ),
          node(
            'health-specialized-mens-prostate-young',
            'Prostate Health Awareness for Young Men'
          )
        ]),
        node(
          'health-specialized-mens-testosterone',
          'Testosterone Optimization',
          [
            node(
              'health-specialized-mens-testosterone-athletes',
              'Testosterone Therapy for Athletes'
            ),
            node(
              'health-specialized-mens-testosterone-natural-40s',
              'Natural Testosterone Boosting for Men in Their 40s'
            )
          ]
        )
      ]),
      node('health-specialized-pediatric', 'Pediatric Health', [
        node('health-specialized-pediatric-nutrition', 'Child Nutrition', [
          node(
            'health-specialized-pediatric-nutrition-allergies',
            'Nutrition for Kids with Allergies'
          ),
          node(
            'health-specialized-pediatric-nutrition-picky',
            'Nutrition Coaching for Picky Eaters'
          )
        ]),
        node(
          'health-specialized-pediatric-obesity',
          'Childhood Obesity Prevention',
          [
            node(
              'health-specialized-pediatric-obesity-schools',
              'Obesity Prevention Programs for Schools'
            ),
            node(
              'health-specialized-pediatric-obesity-parents',
              'Coaching for Parents on Childhood Obesity'
            )
          ]
        )
      ])
    ]),
    node('health-senior', 'Senior Health', [
      node('health-senior-aging-place', 'Aging in Place', [
        node(
          'health-senior-aging-place-modifications',
          'Home Modifications for Seniors'
        ),
        node(
          'health-senior-aging-place-support',
          'Senior Support Services for Aging in Place'
        )
      ]),
      node('health-senior-assisted-living', 'Assisted Living Alternatives', [
        node(
          'health-senior-assisted-living-housing',
          'Alternative Housing Solutions for Seniors'
        ),
        node(
          'health-senior-assisted-living-coliving',
          'Co-Living for Active Seniors'
        )
      ]),
      node('health-senior-fitness', 'Senior Fitness', [
        node(
          'health-senior-fitness-limited-mobility',
          'Fitness Programs for Seniors with Limited Mobility'
        ),
        node(
          'health-senior-fitness-water-aerobics',
          'Water Aerobics for Seniors'
        )
      ])
    ])
  ]
};
