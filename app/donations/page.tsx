import {SiteHeader,SiteFooter}from"../components/SiteChrome";import{DonationsDashboard}from"./DonationsDashboard";
export default function DonationsPage(){return <main><SiteHeader/><section className="page-intro wrap compact"><h1>Donations</h1><p>Search donations and open a record to view its details and payment proof.</p></section><DonationsDashboard/><SiteFooter/></main>}
