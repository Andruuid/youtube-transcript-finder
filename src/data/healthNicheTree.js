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
          ),
          node(
            'health-fitness-strength-home-apartment',
            'Apartment-Friendly Strength Training'
          ),
          node(
            'health-fitness-strength-home-busy-parents',
            'Strength Training for Busy Parents'
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
          ),
          node(
            'health-fitness-strength-bodyweight-beginners',
            'Bodyweight Training for Beginners'
          ),
          node(
            'health-fitness-strength-bodyweight-calisthenics',
            'Calisthenics and Street Workout'
          )
        ]),
        node('health-fitness-strength-powerlifting', 'Powerlifting', [
          node(
            'health-fitness-strength-powerlifting-women',
            'Powerlifting for Women'
          ),
          node(
            'health-fitness-strength-powerlifting-masters',
            'Powerlifting for Masters Athletes'
          )
        ]),
        node('health-fitness-strength-hypertrophy', 'Muscle Building (Hypertrophy)', [
          node(
            'health-fitness-strength-hypertrophy-skinny',
            'Muscle Building for Hard Gainers'
          ),
          node(
            'health-fitness-strength-hypertrophy-women-toning',
            'Strength and Toning for Women'
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
          ),
          node(
            'health-fitness-cardio-hiit-beginners',
            'HIIT for Fitness Beginners'
          ),
          node(
            'health-fitness-cardio-hiit-seniors',
            'Low-Impact HIIT for Seniors'
          )
        ]),
        node('health-fitness-cardio-running', 'Running and Endurance', [
          node(
            'health-fitness-cardio-running-marathon',
            'Marathon Training Programs'
          ),
          node(
            'health-fitness-cardio-running-couch-to-5k',
            'Couch to 5K for Beginners'
          ),
          node(
            'health-fitness-cardio-running-trail',
            'Trail Running and Ultra Endurance'
          )
        ]),
        node('health-fitness-cardio-cycling', 'Cycling Fitness', [
          node(
            'health-fitness-cardio-cycling-indoor',
            'Indoor Cycling and Spin Training'
          ),
          node(
            'health-fitness-cardio-cycling-commuters',
            'Cycling Fitness for Commuters'
          )
        ]),
        node('health-fitness-cardio-swimming', 'Swimming and Aquatic Fitness', [
          node(
            'health-fitness-cardio-swimming-lap',
            'Lap Swimming for Cardio'
          ),
          node(
            'health-fitness-cardio-swimming-joint-friendly',
            'Low-Impact Aquatic Exercise'
          )
        ])
      ]),
      node('health-fitness-yoga', 'Yoga', [
        node('health-fitness-yoga-power', 'Power Yoga', [
          node(
            'health-fitness-yoga-power-athletes',
            'Power Yoga for Athletes'
          ),
          node(
            'health-fitness-yoga-power-weight-loss',
            'Power Yoga for Weight Loss'
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
          ),
          node(
            'health-fitness-yoga-restorative-burnout',
            'Restorative Yoga for Burnout Recovery'
          )
        ]),
        node('health-fitness-yoga-prenatal', 'Prenatal and Postnatal Yoga', [
          node(
            'health-fitness-yoga-prenatal-first-trimester',
            'Prenatal Yoga for First Trimester'
          ),
          node(
            'health-fitness-yoga-prenatal-postpartum',
            'Postnatal Yoga for New Mothers'
          )
        ]),
        node('health-fitness-yoga-chair', 'Chair and Accessible Yoga', [
          node(
            'health-fitness-yoga-chair-seniors',
            'Chair Yoga for Seniors'
          ),
          node(
            'health-fitness-yoga-chair-disability',
            'Adaptive Yoga for Limited Mobility'
          )
        ]),
        node('health-fitness-yoga-hot', 'Hot Yoga and Bikram', [
          node(
            'health-fitness-yoga-hot-detox',
            'Hot Yoga for Detox and Flexibility'
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
            ),
            node(
              'health-fitness-flexibility-office-desk-stretches',
              'Desk Stretch Routines for Sedentary Workers'
            )
          ]
        ),
        node('health-fitness-flexibility-posture', 'Posture Correction', [
          node(
            'health-fitness-flexibility-posture-forward-head',
            'Correcting Forward Head Posture'
          ),
          node(
            'health-fitness-flexibility-posture-spinal',
            'Spinal Alignment and Posture Therapy'
          )
        ])
      ]),
      node('health-fitness-pilates', 'Pilates', [
        node('health-fitness-pilates-reformer', 'Reformer Pilates', [
          node(
            'health-fitness-pilates-reformer-back-pain',
            'Reformer Pilates for Back Pain'
          )
        ]),
        node('health-fitness-pilates-mat', 'Mat Pilates', [
          node(
            'health-fitness-pilates-mat-core',
            'Mat Pilates for Core Strength'
          ),
          node(
            'health-fitness-pilates-mat-beginners',
            'Pilates for Absolute Beginners'
          )
        ])
      ]),
      node('health-fitness-crossfit', 'CrossFit and Functional Fitness', [
        node(
          'health-fitness-crossfit-beginners',
          'CrossFit for Beginners'
        ),
        node('health-fitness-crossfit-home', 'Home Functional Fitness', [
          node(
            'health-fitness-crossfit-home-minimal',
            'Minimal-Equipment Functional Training'
          )
        ])
      ]),
      node('health-fitness-martial-arts', 'Martial Arts and Combat Sports', [
        node(
          'health-fitness-martial-arts-boxing',
          'Boxing Fitness and Conditioning'
        ),
        node(
          'health-fitness-martial-arts-bjj',
          'Brazilian Jiu-Jitsu for Fitness'
        ),
        node(
          'health-fitness-martial-arts-self-defense',
          'Self-Defense Fitness Training'
        )
      ]),
      node('health-fitness-dance', 'Dance Fitness', [
        node(
          'health-fitness-dance-zumba',
          'Zumba and Latin Dance Fitness'
        ),
        node(
          'health-fitness-dance-barre',
          'Barre Fitness Workouts'
        )
      ])
    ]),
    node('health-nutrition', 'Nutrition', [
      node('health-nutrition-diet', 'Diet Plans', [
        node('health-nutrition-diet-keto', 'Ketogenic Diet', [
          node('health-nutrition-diet-keto-diabetics', 'Keto for Diabetics'),
          node('health-nutrition-diet-keto-athletes', 'Keto for Athletes'),
          node(
            'health-nutrition-diet-keto-women',
            'Keto for Women Over 40'
          )
        ]),
        node('health-nutrition-diet-plant', 'Plant-Based Diets', [
          node(
            'health-nutrition-diet-plant-bodybuilders',
            'Plant-Based Nutrition for Bodybuilders'
          ),
          node(
            'health-nutrition-diet-plant-families',
            'Plant-Based Diet for Families'
          ),
          node(
            'health-nutrition-diet-plant-transition',
            'Transitioning to a Plant-Based Diet'
          )
        ]),
        node('health-nutrition-diet-mediterranean', 'Mediterranean Diet', [
          node(
            'health-nutrition-diet-mediterranean-heart',
            'Mediterranean Diet for Heart Health'
          ),
          node(
            'health-nutrition-diet-mediterranean-weight',
            'Mediterranean Diet for Weight Management'
          )
        ]),
        node('health-nutrition-diet-anti-inflammatory', 'Anti-Inflammatory Diet', [
          node(
            'health-nutrition-diet-anti-inflammatory-autoimmune',
            'Anti-Inflammatory Diet for Autoimmune Conditions'
          ),
          node(
            'health-nutrition-diet-anti-inflammatory-joint',
            'Anti-Inflammatory Diet for Joint Pain'
          )
        ]),
        node('health-nutrition-diet-low-carb', 'Low-Carb and Carb Cycling', [
          node(
            'health-nutrition-diet-low-carb-women',
            'Low-Carb Nutrition for Women'
          ),
          node(
            'health-nutrition-diet-low-carb-athletes',
            'Carb Cycling for Athletes'
          )
        ])
      ]),
      node('health-nutrition-fasting', 'Intermittent Fasting', [
        node('health-nutrition-fasting-16-8', '16:8 Intermittent Fasting', [
          node(
            'health-nutrition-fasting-16-8-women',
            '16:8 Fasting for Women'
          ),
          node(
            'health-nutrition-fasting-16-8-busy',
            'Intermittent Fasting for Busy Professionals'
          )
        ]),
        node('health-nutrition-fasting-omad', 'OMAD and Extended Fasting', [
          node(
            'health-nutrition-fasting-omad-beginners',
            'One Meal a Day for Beginners'
          )
        ])
      ]),
      node('health-nutrition-meal-prep', 'Meal Prep and Planning', [
        node(
          'health-nutrition-meal-prep-batch',
          'Batch Cooking for Healthy Eating'
        ),
        node(
          'health-nutrition-meal-prep-budget',
          'Budget-Friendly Meal Prep'
        ),
        node(
          'health-nutrition-meal-prep-single',
          'Meal Prep for Single People'
        )
      ]),
      node('health-nutrition-sports', 'Sports Nutrition', [
        node(
          'health-nutrition-sports-endurance',
          'Nutrition for Endurance Athletes'
        ),
        node(
          'health-nutrition-sports-strength',
          'Nutrition for Strength Athletes'
        ),
        node(
          'health-nutrition-sports-recovery',
          'Post-Workout Recovery Nutrition'
        )
      ]),
      node('health-nutrition-allergies', 'Food Allergies and Intolerances', [
        node(
          'health-nutrition-allergies-gluten-free',
          'Gluten-Free Living'
        ),
        node(
          'health-nutrition-allergies-dairy-free',
          'Dairy-Free and Lactose Intolerance'
        ),
        node(
          'health-nutrition-allergies-fodmap',
          'Low-FODMAP Diet for IBS'
        )
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
          ),
          node(
            'health-nutrition-supplements-pre-natural',
            'Natural Pre-Workout Alternatives'
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
          ),
          node(
            'health-nutrition-supplements-health-immune',
            'Immune Support Supplements'
          )
        ]),
        node('health-nutrition-supplements-protein', 'Protein Supplements', [
          node(
            'health-nutrition-supplements-protein-plant',
            'Plant-Based Protein Powders'
          ),
          node(
            'health-nutrition-supplements-protein-collagen',
            'Collagen Supplements for Skin and Joints'
          )
        ])
      ]),
      node('health-nutrition-emotional-eating', 'Emotional Eating and Food Psychology', [
        node(
          'health-nutrition-emotional-eating-stress',
          'Managing Stress-Related Eating'
        ),
        node(
          'health-nutrition-emotional-eating-mindful',
          'Mindful Eating Practices'
        )
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
          ),
          node(
            'health-mental-stress-mindfulness-teens',
            'Mindfulness for Teenagers'
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
          ),
          node(
            'health-mental-stress-relief-caregivers',
            'Stress Relief for Caregivers'
          )
        ]),
        node('health-mental-stress-burnout', 'Burnout Recovery', [
          node(
            'health-mental-stress-burnout-healthcare',
            'Burnout Recovery for Healthcare Workers'
          ),
          node(
            'health-mental-stress-burnout-teachers',
            'Burnout Recovery for Teachers'
          )
        ])
      ]),
      node('health-mental-anxiety', 'Anxiety Disorders', [
        node(
          'health-mental-anxiety-social',
          'Social Anxiety Support'
        ),
        node(
          'health-mental-anxiety-panic',
          'Panic Disorder Management'
        ),
        node(
          'health-mental-anxiety-health',
          'Health Anxiety and Cyberchondria'
        )
      ]),
      node('health-mental-depression', 'Depression Support', [
        node(
          'health-mental-depression-mild',
          'Managing Mild to Moderate Depression'
        ),
        node(
          'health-mental-depression-seasonal',
          'Seasonal Affective Disorder (SAD)'
        )
      ]),
      node('health-mental-adhd', 'ADHD Management', [
        node(
          'health-mental-adhd-adults',
          'ADHD Coaching for Adults'
        ),
        node(
          'health-mental-adhd-children',
          'ADHD Support for Parents of Children'
        )
      ]),
      node('health-mental-ptsd', 'PTSD and Trauma Recovery', [
        node(
          'health-mental-ptsd-veterans',
          'PTSD Support for Veterans'
        ),
        node(
          'health-mental-ptsd-emdr',
          'EMDR and Trauma-Informed Therapy'
        )
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
          ),
          node(
            'health-mental-therapy-online-rural',
            'Online Therapy for Rural Communities'
          )
        ]),
        node('health-mental-therapy-cbt', 'Cognitive Behavioral Therapy (CBT)', [
          node('health-mental-therapy-cbt-adolescents', 'CBT for Adolescents'),
          node(
            'health-mental-therapy-cbt-ocd',
            'CBT for Obsessive-Compulsive Disorder'
          ),
          node(
            'health-mental-therapy-cbt-insomnia',
            'CBT for Insomnia (CBT-I)'
          )
        ]),
        node('health-mental-therapy-couples', 'Couples and Family Therapy', [
          node(
            'health-mental-therapy-couples-communication',
            'Communication Skills for Couples'
          )
        ])
      ]),
      node('health-mental-self-care', 'Self-Care and Self-Love', [
        node(
          'health-mental-self-care-daily',
          'Daily Self-Care Routines'
        ),
        node(
          'health-mental-self-care-boundaries',
          'Setting Healthy Boundaries'
        )
      ]),
      node('health-mental-digital', 'Digital Wellness and Social Media', [
        node(
          'health-mental-digital-detox',
          'Digital Detox Programs'
        ),
        node(
          'health-mental-digital-social-media',
          'Social Media Impact on Mental Health'
        )
      ]),
      node('health-mental-mens', "Men's Mental Health", [
        node(
          'health-mental-mens-depression',
          'Depression Support for Men'
        ),
        node(
          'health-mental-mens-isolation',
          'Combating Loneliness in Men'
        )
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
        ),
        node(
          'health-preventative-immunity-seasonal',
          'Seasonal Cold and Flu Prevention'
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
        ),
        node(
          'health-preventative-longevity-biological-age',
          'Biological Age Optimization'
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
        ),
        node(
          'health-preventative-sleep-insomnia',
          'Natural Insomnia Remedies'
        ),
        node(
          'health-preventative-sleep-shift-workers',
          'Sleep Health for Shift Workers'
        )
      ]),
      node('health-preventative-screenings', 'Health Screenings', [
        node(
          'health-preventative-screenings-cancer',
          'Cancer Screening Awareness'
        ),
        node(
          'health-preventative-screenings-heart',
          'Heart Disease Risk Screening'
        ),
        node(
          'health-preventative-screenings-diabetes',
          'Diabetes and Prediabetes Screening'
        )
      ]),
      node('health-preventative-eye', 'Eye Health', [
        node(
          'health-preventative-eye-screen-strain',
          'Digital Eye Strain Prevention'
        ),
        node(
          'health-preventative-eye-age-related',
          'Age-Related Vision Health'
        )
      ]),
      node('health-preventative-biohacking', 'Biohacking Basics', [
        node(
          'health-preventative-biohacking-cold-exposure',
          'Cold Exposure and Ice Baths'
        ),
        node(
          'health-preventative-biohacking-wearables',
          'Health Tracking with Wearables'
        ),
        node(
          'health-preventative-biohacking-nootropics',
          'Nootropics and Cognitive Enhancement'
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
        ),
        node(
          'health-alternative-herbal-sleep',
          'Herbal Remedies for Sleep'
        ),
        node(
          'health-alternative-herbal-immune',
          'Herbal Immune Support'
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
        ),
        node(
          'health-alternative-acupuncture-migraine',
          'Acupuncture for Migraine Relief'
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
        ),
        node(
          'health-alternative-aromatherapy-headaches',
          'Essential Oils for Headache Relief'
        )
      ]),
      node('health-alternative-ayurveda', 'Ayurveda', [
        node(
          'health-alternative-ayurveda-dosha',
          'Ayurvedic Dosha Balancing'
        ),
        node(
          'health-alternative-ayurveda-digestion',
          'Ayurvedic Digestive Health'
        )
      ]),
      node('health-alternative-naturopathy', 'Naturopathy', [
        node(
          'health-alternative-naturopathy-hormones',
          'Naturopathic Hormone Balancing'
        ),
        node(
          'health-alternative-naturopathy-detox',
          'Naturopathic Detox Programs'
        )
      ]),
      node('health-alternative-chiropractic', 'Chiropractic Care', [
        node(
          'health-alternative-chiropractic-back-pain',
          'Chiropractic for Back Pain'
        ),
        node(
          'health-alternative-chiropractic-headaches',
          'Chiropractic for Tension Headaches'
        )
      ]),
      node('health-alternative-tcm', 'Traditional Chinese Medicine', [
        node(
          'health-alternative-tcm-herbal',
          'Chinese Herbal Formulas'
        ),
        node(
          'health-alternative-tcm-cupping',
          'Cupping Therapy'
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
        ),
        node(
          'health-pt-injury-acl',
          'ACL Tear Rehabilitation'
        ),
        node(
          'health-pt-injury-rotator-cuff',
          'Rotator Cuff Injury Recovery'
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
        ),
        node(
          'health-pt-chronic-pain-fibromyalgia',
          'Physical Therapy for Fibromyalgia'
        ),
        node(
          'health-pt-chronic-pain-lower-back',
          'Chronic Lower Back Pain Programs'
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
        ),
        node(
          'health-pt-mobility-stroke',
          'Stroke Recovery and Mobility'
        )
      ]),
      node('health-pt-sports', 'Sports Injury Prevention', [
        node(
          'health-pt-sports-knee',
          'Knee Injury Prevention for Athletes'
        ),
        node(
          'health-pt-sports-shoulder',
          'Shoulder Stability for Overhead Athletes'
        )
      ]),
      node('health-pt-vestibular', 'Vestibular and Balance Therapy', [
        node(
          'health-pt-vestibular-vertigo',
          'Vestibular Rehab for Vertigo'
        ),
        node(
          'health-pt-vestibular-falls',
          'Balance Training for Fall Prevention'
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
          ),
          node(
            'health-specialized-womens-fertility-pcos',
            'Fertility Support for PCOS'
          )
        ]),
        node('health-specialized-womens-menopause', 'Menopause Support', [
          node(
            'health-specialized-womens-menopause-professional',
            'Menopause Coaching for Professional Women'
          ),
          node(
            'health-specialized-womens-menopause-perimenopause',
            'Perimenopause Awareness and Support'
          ),
          node(
            'health-specialized-womens-menopause-hormone',
            'Hormone Replacement Therapy Education'
          )
        ]),
        node('health-specialized-womens-pregnancy', 'Pregnancy and Postpartum', [
          node(
            'health-specialized-womens-pregnancy-nutrition',
            'Pregnancy Nutrition Programs'
          ),
          node(
            'health-specialized-womens-pregnancy-mental',
            'Postpartum Mental Health Support'
          )
        ]),
        node('health-specialized-womens-endometriosis', 'Endometriosis', [
          node(
            'health-specialized-womens-endometriosis-pain',
            'Endometriosis Pain Management'
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
            ),
            node(
              'health-specialized-mens-testosterone-trt',
              'TRT Education and Monitoring'
            )
          ]
        ),
        node('health-specialized-mens-hair-loss', 'Hair Loss and Hair Care', [
          node(
            'health-specialized-mens-hair-loss-prevention',
            'Male Pattern Baldness Prevention'
          ),
          node(
            'health-specialized-mens-hair-loss-treatment',
            'Hair Loss Treatment Options for Men'
          )
        ])
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
          ),
          node(
            'health-specialized-pediatric-nutrition-teens',
            'Teen Nutrition and Body Image'
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
        ),
        node('health-specialized-pediatric-development', 'Child Development', [
          node(
            'health-specialized-pediatric-development-milestones',
            'Early Childhood Development Milestones'
          ),
          node(
            'health-specialized-pediatric-development-adhd',
            'ADHD and Learning Support for Children'
          )
        ])
      ]),
      node('health-specialized-reproductive', 'Sexual and Reproductive Health', [
        node(
          'health-specialized-reproductive-contraception',
          'Contraception Education'
        ),
        node(
          'health-specialized-reproductive-sti',
          'STI Prevention and Awareness'
        ),
        node(
          'health-specialized-reproductive-intimacy',
          'Sexual Wellness and Intimacy'
        )
      ]),
      node('health-specialized-lgbtq', 'LGBTQ+ Health', [
        node(
          'health-specialized-lgbtq-transgender',
          'Transgender Health and Hormone Care'
        ),
        node(
          'health-specialized-lgbtq-mental',
          'Mental Health Support for LGBTQ+ Youth'
        )
      ]),
      node('health-specialized-teen', 'Adolescent Health', [
        node(
          'health-specialized-teen-mental',
          'Teen Mental Health and Wellness'
        ),
        node(
          'health-specialized-teen-substance',
          'Teen Substance Use Prevention'
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
        ),
        node(
          'health-senior-aging-place-technology',
          'Smart Home Technology for Seniors'
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
        ),
        node(
          'health-senior-fitness-balance',
          'Balance and Fall Prevention Exercise'
        )
      ]),
      node('health-senior-cognitive', 'Dementia and Cognitive Health', [
        node(
          'health-senior-cognitive-alzheimers',
          "Alzheimer's Caregiver Support"
        ),
        node(
          'health-senior-cognitive-brain-training',
          'Brain Training for Cognitive Decline'
        )
      ]),
      node('health-senior-nutrition', 'Senior Nutrition', [
        node(
          'health-senior-nutrition-appetite',
          'Nutrition for Seniors with Low Appetite'
        ),
        node(
          'health-senior-nutrition-bone',
          'Bone Health Nutrition for Seniors'
        )
      ])
    ]),
    node('health-weight', 'Weight Management', [
      node('health-weight-loss', 'Weight Loss Programs', [
        node('health-weight-loss-women', 'Weight Loss for Women', [
          node(
            'health-weight-loss-women-over-40',
            'Weight Loss for Women Over 40'
          ),
          node(
            'health-weight-loss-women-postpartum',
            'Postpartum Weight Loss'
          )
        ]),
        node('health-weight-loss-men', 'Weight Loss for Men', [
          node(
            'health-weight-loss-men-belly-fat',
            'Belly Fat Reduction for Men'
          )
        ]),
        node('health-weight-loss-sustainable', 'Sustainable Weight Loss', [
          node(
            'health-weight-loss-sustainable-habits',
            'Habit-Based Weight Loss Coaching'
          ),
          node(
            'health-weight-loss-sustainable-no-diet',
            'Non-Diet Approach to Weight Management'
          )
        ])
      ]),
      node('health-weight-gain', 'Healthy Weight Gain', [
        node(
          'health-weight-gain-muscle',
          'Lean Muscle Weight Gain'
        ),
        node(
          'health-weight-gain-underweight',
          'Nutrition for Underweight Adults'
        )
      ]),
      node('health-weight-eating-disorders', 'Eating Disorder Recovery', [
        node(
          'health-weight-eating-disorders-binge',
          'Binge Eating Disorder Recovery'
        ),
        node(
          'health-weight-eating-disorders-anorexia',
          'Anorexia Recovery Support Resources'
        )
      ])
    ]),
    node('health-gut', 'Gut Health and Digestive Wellness', [
      node('health-gut-microbiome', 'Gut Microbiome', [
        node(
          'health-gut-microbiome-probiotics',
          'Probiotics and Prebiotics Guide'
        ),
        node(
          'health-gut-microbiome-reset',
          'Gut Reset and Microbiome Restoration'
        ),
        node(
          'health-gut-microbiome-gut-brain',
          'Gut-Brain Connection and Mood'
        )
      ]),
      node('health-gut-conditions', 'Digestive Conditions', [
        node(
          'health-gut-conditions-ibs',
          'Irritable Bowel Syndrome (IBS) Management'
        ),
        node(
          'health-gut-conditions-gerd',
          'GERD and Acid Reflux Management'
        ),
        node(
          'health-gut-conditions-sibo',
          'SIBO Treatment and Diet'
        ),
        node(
          'health-gut-conditions-celiac',
          'Celiac Disease and Gluten Sensitivity'
        )
      ]),
      node('health-gut-healing', 'Gut Healing Protocols', [
        node(
          'health-gut-healing-leaky-gut',
          'Leaky Gut Healing Programs'
        ),
        node(
          'health-gut-healing-post-antibiotics',
          'Gut Recovery After Antibiotics'
        )
      ])
    ]),
    node('health-skin', 'Skin, Hair and Beauty Health', [
      node('health-skin-conditions', 'Skin Conditions', [
        node(
          'health-skin-conditions-acne',
          'Acne Treatment and Prevention'
        ),
        node(
          'health-skin-conditions-eczema',
          'Eczema and Dermatitis Management'
        ),
        node(
          'health-skin-conditions-psoriasis',
          'Psoriasis Care and Treatment'
        ),
        node(
          'health-skin-conditions-rosacea',
          'Rosacea Management'
        )
      ]),
      node('health-skin-aging', 'Anti-Aging Skincare', [
        node(
          'health-skin-aging-retinol',
          'Retinol and Active Ingredient Skincare'
        ),
        node(
          'health-skin-aging-sun',
          'Sun Protection and UV Damage Prevention'
        )
      ]),
      node('health-skin-hair', 'Hair Health', [
        node(
          'health-skin-hair-thinning-women',
          'Hair Thinning Solutions for Women'
        ),
        node(
          'health-skin-hair-scalp',
          'Scalp Health and Dandruff Treatment'
        )
      ]),
      node('health-skin-natural', 'Clean and Natural Beauty', [
        node(
          'health-skin-natural-ingredients',
          'Clean Beauty Ingredient Education'
        ),
        node(
          'health-skin-natural-diy',
          'DIY Natural Skincare Remedies'
        )
      ])
    ]),
    node('health-chronic', 'Chronic Disease Management', [
      node('health-chronic-diabetes', 'Diabetes Management', [
        node(
          'health-chronic-diabetes-type2',
          'Type 2 Diabetes Lifestyle Management'
        ),
        node(
          'health-chronic-diabetes-type1',
          'Type 1 Diabetes Support and Education'
        ),
        node(
          'health-chronic-diabetes-prediabetes',
          'Prediabetes Reversal Programs'
        )
      ]),
      node('health-chronic-heart', 'Heart Disease Prevention', [
        node(
          'health-chronic-heart-hypertension',
          'High Blood Pressure Management'
        ),
        node(
          'health-chronic-heart-cholesterol',
          'Cholesterol and Lipid Management'
        ),
        node(
          'health-chronic-heart-recovery',
          'Cardiac Rehabilitation Programs'
        )
      ]),
      node('health-chronic-autoimmune', 'Autoimmune Disease Management', [
        node(
          'health-chronic-autoimmune-lupus',
          'Lupus Management and Support'
        ),
        node(
          'health-chronic-autoimmune-rheumatoid',
          'Rheumatoid Arthritis Lifestyle Management'
        ),
        node(
          'health-chronic-autoimmune-hashimotos',
          "Hashimoto's Thyroiditis Support"
        )
      ]),
      node('health-chronic-respiratory', 'Respiratory Conditions', [
        node(
          'health-chronic-respiratory-asthma',
          'Asthma Management and Triggers'
        ),
        node(
          'health-chronic-respiratory-copd',
          'COPD Lifestyle Support'
        )
      ]),
      node('health-chronic-fatigue', 'Chronic Fatigue Syndrome', [
        node(
          'health-chronic-fatigue-pacing',
          'Energy Pacing for Chronic Fatigue'
        ),
        node(
          'health-chronic-fatigue-mecfs',
          'ME/CFS Management Strategies'
        )
      ]),
      node('health-chronic-allergies', 'Allergy Management', [
        node(
          'health-chronic-allergies-food',
          'Food Allergy Management'
        ),
        node(
          'health-chronic-allergies-environmental',
          'Environmental and Seasonal Allergies'
        )
      ])
    ]),
    node('health-dental', 'Dental and Oral Health', [
      node('health-dental-prevention', 'Preventive Dental Care', [
        node(
          'health-dental-prevention-gum',
          'Gum Disease Prevention'
        ),
        node(
          'health-dental-prevention-cavity',
          'Cavity Prevention for Adults and Children'
        )
      ]),
      node('health-dental-cosmetic', 'Cosmetic Dentistry', [
        node(
          'health-dental-cosmetic-whitening',
          'Teeth Whitening Options'
        ),
        node(
          'health-dental-cosmetic-orthodontics',
          'Adult Orthodontics and Aligners'
        )
      ]),
      node('health-dental-specialized', 'Specialized Oral Health', [
        node(
          'health-dental-specialized-tmj',
          'TMJ and Jaw Pain Management'
        ),
        node(
          'health-dental-specialized-sleep-apnea',
          'Oral Appliances for Sleep Apnea'
        )
      ])
    ]),
    node('health-addiction', 'Addiction and Recovery', [
      node('health-addiction-substance', 'Substance Use Recovery', [
        node(
          'health-addiction-substance-alcohol',
          'Alcohol Recovery Support'
        ),
        node(
          'health-addiction-substance-opioid',
          'Opioid Addiction Recovery Resources'
        )
      ]),
      node('health-addiction-behavioral', 'Behavioral Addictions', [
        node(
          'health-addiction-behavioral-gambling',
          'Gambling Addiction Recovery'
        ),
        node(
          'health-addiction-behavioral-screen',
          'Screen and Gaming Addiction'
        )
      ]),
      node('health-addiction-support', 'Recovery Support', [
        node(
          'health-addiction-support-family',
          'Family Support for Addiction Recovery'
        ),
        node(
          'health-addiction-support-sober',
          'Sober Living and Relapse Prevention'
        )
      ])
    ]),
    node('health-occupational', 'Occupational and Lifestyle Health', [
      node('health-occupational-remote', 'Remote Worker Health', [
        node(
          'health-occupational-remote-ergonomics',
          'Home Office Ergonomics'
        ),
        node(
          'health-occupational-remote-sedentary',
          'Combating Sedentary Remote Work'
        ),
        node(
          'health-occupational-remote-isolation',
          'Remote Work Loneliness and Isolation'
        )
      ]),
      node('health-occupational-shift', 'Shift Worker Health', [
        node(
          'health-occupational-shift-nutrition',
          'Nutrition for Night Shift Workers'
        ),
        node(
          'health-occupational-shift-sleep',
          'Sleep Optimization for Shift Workers'
        )
      ]),
      node('health-occupational-trades', 'Trade and Labor Health', [
        node(
          'health-occupational-trades-construction',
          'Health for Construction Workers'
        ),
        node(
          'health-occupational-trades-nurses',
          'Health for Nurses and Healthcare Workers'
        ),
        node(
          'health-occupational-trades-drivers',
          'Fitness for Truck Drivers and Commuters'
        )
      ]),
      node('health-occupational-teachers', 'Educator Health', [
        node(
          'health-occupational-teachers-stress',
          'Stress Management for Teachers'
        ),
        node(
          'health-occupational-teachers-voice',
          'Voice Care for Teachers and Speakers'
        )
      ]),
      node('health-occupational-travel', 'Travel Health', [
        node(
          'health-occupational-travel-jet-lag',
          'Jet Lag and Travel Fatigue Management'
        ),
        node(
          'health-occupational-travel-fitness',
          'Staying Fit While Traveling'
        )
      ])
    ]),
    node('health-functional', 'Functional Medicine', [
      node('health-functional-root-cause', 'Root Cause Health', [
        node(
          'health-functional-root-cause-testing',
          'Functional Lab Testing and Interpretation'
        ),
        node(
          'health-functional-root-cause-inflammation',
          'Chronic Inflammation Assessment'
        )
      ]),
      node('health-functional-hormones', 'Functional Hormone Health', [
        node(
          'health-functional-hormones-thyroid',
          'Thyroid Optimization Programs'
        ),
        node(
          'health-functional-hormones-adrenal',
          'Adrenal Fatigue and HPA Axis Support'
        ),
        node(
          'health-functional-hormones-insulin',
          'Insulin Resistance Reversal'
        )
      ]),
      node('health-functional-detox', 'Detoxification Support', [
        node(
          'health-functional-detox-liver',
          'Liver Detox and Support Protocols'
        ),
        node(
          'health-functional-detox-heavy-metals',
          'Heavy Metal Detox Education'
        )
      ])
    ])
  ]
};
