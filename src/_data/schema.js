/**
 * Defines the base schema.org data for all pages.
 *
 * This data can be overridden on a per-page basis using 11ty's data cascade.
 * The final object must be a valid Schema.org JSON-LD context when serialized.
 *
 * @see https://schema.org/WebPage
 * @property {string} @context - The schema.org context.
 * @property {string} @type - The schema.org type.
 */
export default {
  "@context": "https://schema.org",
  "@type": "WebPage",
  description: "Cyberhome of David W. Keith",
  
  author: {
    "@type": "Person",
    name: "David W. Keith",
    url: "https://dwk.io",
    image: "https://dwk.io/icon-512.png",
    email: "mailto:me@dwk.io",
    alumniOf:[
      { "@type": "CollegeOrUniversity",
        name: "Cornell College",
        url: "https://cornellcollege.edu/",
      },
      { "@type": "HighSchool",
        name: "St. Johnsbury Academy",
        url: "https://stjacademy.org"
      }
    ],
    sameAs:[
      "https://bsky.app/profile/dwk.io",
      "https://github.com/davidwkeith",
      "https://gitlab.com/davidwkeith",
      "https://keybase.io/dwkeith",
      "https://www.facebook.com/davidwkeith",
      "https://www.linkedin.com/in/davidwkeith",
      "https://www.reddit.com/user/dwkeith",
      "https://xn--4t8h.dwk.io/@dwk",
    ],
    affiliation: {
      "@type": "Organization",
      name: "Silicon Valley Bicycle Coalition",
      url: "https://bikesiliconvalley.org"
    },
    birthDate: "1978-12-14",
    birthPlace: {
      "@type": "Place",
      name: "Boston, MA",
      url: "https://www.boston.gov"
    },
    callSign: "N1UEU",
    familyName: "Keith",
    givenName: "David",
    additionalName: "William",
    gender: "Male",
    height: "173 cm",
    nationality: {
      "@type": "Country",
      name: "United States of America",
      url: "https://www.usa.gov"
    }
  }
}