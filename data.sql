--
-- PostgreSQL database dump
--

\restrict W1fnMaqW12R94zaR0jpfWorSBDpzlOf6v4c03BhKhswy1rjsp1xDNAaIJ9DtzdZ

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Ubuntu 17.10-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) FROM stdin;
\.


--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.custom_oauth_providers (id, provider_type, identifier, name, client_id, client_secret, acceptable_client_ids, scopes, pkce_enabled, attribute_mapping, authorization_params, enabled, email_optional, issuer, discovery_url, skip_nonce_check, cached_discovery, discovery_cached_at, authorization_url, token_url, userinfo_url, jwks_uri, created_at, updated_at, custom_claims_allowlist) FROM stdin;
\.


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.flow_state (id, user_id, auth_code, code_challenge_method, code_challenge, provider_type, provider_access_token, provider_refresh_token, created_at, updated_at, authentication_method, auth_code_issued_at, invite_token, referrer, oauth_client_state_id, linking_target_id, email_optional) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) FROM stdin;
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id) FROM stdin;
\.


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.instances (id, uuid, raw_base_config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.oauth_clients (id, client_secret_hash, registration_type, redirect_uris, grant_types, client_name, client_uri, logo_uri, created_at, updated_at, deleted_at, client_type, token_endpoint_auth_method) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.sessions (id, user_id, created_at, updated_at, factor_id, aal, not_after, refreshed_at, user_agent, ip, tag, oauth_client_id, refresh_token_hmac_key, refresh_token_counter, scopes) FROM stdin;
\.


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method, id) FROM stdin;
\.


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret, phone, last_challenged_at, web_authn_credential, web_authn_aaguid, last_webauthn_challenge_data) FROM stdin;
\.


--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.mfa_challenges (id, factor_id, created_at, verified_at, ip_address, otp_code, web_authn_session_data) FROM stdin;
\.


--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.oauth_authorizations (id, authorization_id, client_id, user_id, redirect_uri, scope, state, resource, code_challenge, code_challenge_method, response_type, status, authorization_code, created_at, expires_at, approved_at, nonce) FROM stdin;
\.


--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.oauth_client_states (id, provider_type, code_verifier, created_at) FROM stdin;
\.


--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.oauth_consents (id, user_id, client_id, scopes, granted_at, revoked_at) FROM stdin;
\.


--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.one_time_tokens (id, user_id, token_type, token_hash, relates_to, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) FROM stdin;
\.


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.sso_providers (id, resource_id, created_at, updated_at, disabled) FROM stdin;
\.


--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.saml_providers (id, sso_provider_id, entity_id, metadata_xml, metadata_url, attribute_mapping, created_at, updated_at, name_id_format) FROM stdin;
\.


--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.saml_relay_states (id, sso_provider_id, request_id, for_email, redirect_to, created_at, updated_at, flow_state_id) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.schema_migrations (version) FROM stdin;
20171026211738
20171026211808
20171026211834
20180103212743
20180108183307
20180119214651
20180125194653
00
20210710035447
20210722035447
20210730183235
20210909172000
20210927181326
20211122151130
20211124214934
20211202183645
20220114185221
20220114185340
20220224000811
20220323170000
20220429102000
20220531120530
20220614074223
20220811173540
20221003041349
20221003041400
20221011041400
20221020193600
20221021073300
20221021082433
20221027105023
20221114143122
20221114143410
20221125140132
20221208132122
20221215195500
20221215195800
20221215195900
20230116124310
20230116124412
20230131181311
20230322519590
20230402418590
20230411005111
20230508135423
20230523124323
20230818113222
20230914180801
20231027141322
20231114161723
20231117164230
20240115144230
20240214120130
20240306115329
20240314092811
20240427152123
20240612123726
20240729123726
20240802193726
20240806073726
20241009103726
20250717082212
20250731150234
20250804100000
20250901200500
20250903112500
20250904133000
20250925093508
20251007112900
20251104100000
20251111201300
20251201000000
20260115000000
20260121000000
20260219120000
20260302000000
20260625000000
\.


--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.sso_domains (id, sso_provider_id, domain, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.webauthn_challenges (id, user_id, challenge_type, session_data, created_at, expires_at) FROM stdin;
\.


--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.webauthn_credentials (id, user_id, credential_id, public_key, attestation_type, aaguid, sign_count, transports, backup_eligible, backed_up, friendly_name, created_at, updated_at, last_used_at) FROM stdin;
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.clients (id, company_name, target_raise) FROM stdin;
\.


--
-- Data for Name: verticals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.verticals (id, vertical_name) FROM stdin;
002720c1-bea6-45d3-9039-bfde52ab0d24	Ad Tech
a8023f1f-6684-49bc-a2e6-03355ee11d90	Sport Tech
4192e058-207a-4ac7-a3ed-f1b5495828ea	Consumer Products
c6834971-edd5-4b06-8d80-c4ce3b2cad7b	Commercial Real Estate (CRE)
db418a6b-18a0-4f80-9183-81d8f40be974	Fintech & Crypto
531d29ca-fbb6-4090-93ca-27989844cc46	AI
a8009b90-5fa9-428c-b5ce-69505246f955	Cybersecurity
bb66aaa2-76a9-4a32-8eb3-7273594ed1ab	Consumer
8a4f618c-db0a-4685-8a56-31893dad5eca	Marketplace & Commerce
bf1764a7-7f1c-48ca-819d-b922db907c09	Infrastructure
92a5b95a-b64f-445e-87ad-04bf2620f4cd	SaaS
\.


--
-- Data for Name: client_verticals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.client_verticals (id, client_id, vertical_id) FROM stdin;
\.


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.companies (id, name, website, description) FROM stdin;
4da0b124-354a-4839-ad40-9474f14e09b4	0x Labs	http://0x.org	0x Labs is a global technology company at the forefront of blockchain adoption and the architect of trusted web3 exchange infrastructure 0x. With a mission to “build a tokenized world where all value can flow freely,” they help businesses eliminate the complexity of accessing decentralized markets across all layers of the Web3 exchange stack.
ff366e4e-1695-47dc-9bad-c0de2ec359a0	7AI	https://7ai.com/	7AI empowers enterprises to reimagine security operations, using AI agents to finally deliver security outcomes today. With its Service as Software delivery model, 7AI partners with customers to understand the manual, repetitive, non-human work that wastes human talent and leverages AI agents to ingest alerts, enrich data, perform end-to-end investigations, and let people focus on high value work.
b925c276-8f2c-4f98-a91d-e0d288c1cee5	Ava	https://www.meetava.com/	Credit building app for everyone
d91d18ac-4581-4ab5-ac24-3a4bb849bba0	Abnormal	https://abnormal.ai/	Abnormal AI is a cloud email security company for Office 365 and G Suite. The Abnormal AI platform leverages data science to stop the full range of email threats with a unique focus on modern social engineering attacks.
2f50c989-f908-4aff-b73d-ebac565a53c8	Adept	http://www.adept.ai	Adept is an ML research and product lab building useful general intelligence in the form of a universal AI teammate. It was founded by a team with deep roots in ML, including key contributors to Google, DeepMind, and OpenAI’s largest models. Adept envisions a world where people and computers work together creatively to solve problems.
4794d070-21b0-40d9-8a7f-789408fcbc66	AI Fund	https://aifund.ai/	Building transformative AI companies from the ground up.
564da3ef-756a-49e1-a71d-724c757e29e2	airbnb	https://www.airbnb.com/	Airbnb is one of the world’s largest marketplaces for unique, authentic places to stay and things to do, offering over 7 million accommodations and 40,000 handcrafted activities, all powered by local hosts. An economic empowerment engine, Airbnb has helped millions of hospitality entrepreneurs monetize their spaces and their passions while keeping the financial benefits of tourism in their own communities. With more than half a billion guest arrivals to date, and accessible in 62 languages across 220+ countries and regions, Airbnb promotes people-to-people connection, community and trust around the world.
3d8649a3-6e45-4580-a226-263e62e8f514	AirOps	https://www.airops.com/	AirOps helps brands get found and stay found in the AI era. It’s the content engineering platform helping top marketing teams grow visibility and win in AI search. Teams like Webflow, Klaviyo, Wiz, and Kayak use AirOps to measure their content's performance across SEO and AI platforms, take precise action on the highest-impact opportunities, and measure results, creating a continuous loop of unique, performant content that compounds.
563578b7-ff05-4676-9ab0-acf0de00f1f4	Altara	https://www.altara.co/	Altara is building the scientific intelligence platform for physical science companies, from R&D to manufacturing. Its AI agents reason across complex, multimodal technical data to help scientists and engineers resolve failures faster, design better experiments, and accelerate discovery.
6a5ce6d5-3563-47e6-99a9-da92a9d92fba	Amplify MD	https://amplifymd.com	AmplifyMD connects medical institutions with a lack of specialty access – often in rural or small regions of the United States – to a network of leading specialists. The company provides both the clinical team as well as the software to streamline and automate virtual care delivery and billing workflows and integrates seamlessly with hospitals’ existing EHRs.
904a60a5-f71f-4097-a873-f56ef847a141	Anthropic	https://www.anthropic.com/	Anthropic is an AI research company that builds reliable, interpretable, and steerable AI systems. Their first product is Claude, an AI assistant for tasks at any scale.
54b3dab3-5222-47e3-88f5-e4f4e06f08ad	Apiiro	http://www.apiiro.com	Apiiro is the application security posture management (ASPM) platform that empowers application security, software development and risk management teams to design, develop, and deliver secure software faster. Only Apiiro automatically discovers and generates a comprehensive map of software architecture from code to supply chain to infrastructure – spanning every API, code module, GenAI, encryption, authentication framework, open-source dependency, container, and more. Global enterprises like Morgan Stanley, Blackrock, Rakuten, SoFi, and Shell rely on Apiiro to achieve 80% process automation, automate 1/3 of manual security controls, reduce their remediation times (MTTR) by up to 85%, and get back hundreds of thousands in security savings per year.
d0c2b4f8-6c00-4f1e-8083-7448dbe24f7e	Appdynamics	https://www.appdynamics.com/	Next generation application performance management.
70071536-b9fc-4a61-9de4-06bad75e3158	Aspora	https://www.aspora.com/	Aspora is building banking solutions for immigrant diasporas starting with the Indian Diaspora. The company helps over 250,000 users remit money and save $15M in fees.
cd2bfa7d-11f5-49c6-a5b1-741f9e1d3be4	Atomic	https://atomic.financial/	Atomic simplifies complicated payroll integrations with a single API that covers over 450 unique payroll connections, including incumbent payroll providers, bespoke enterprise solutions, modern HR tech providers, gig-economy platforms and government systems. Atomic’s payroll APIs cover 75% of the U.S. workforce with a combined reach of 120 million workers.
46cbed95-bc3f-47f4-8f84-7370495dbd75	Atomic AI	https://atomic.ai/	AI-driven RNA drug discovery, with atomic precision.
5150dda5-f5d9-48c0-8733-cba01ef473c1	Arista	https://www.arista.com	Software driven cloud networking solutions.
6a9ff221-ce88-44b1-bc0f-bedd2f0f0be4	Aurora	https://aurora.tech/	Aurorais delivering the benefits of self-driving technology safely, quickly, and broadly. In 2017, leading autonomy experts — Chris Urmson, Drew Bagnell, and Sterling Anderson – came together to accelerate the adoption of driverless vehicles by developing the Aurora Driver and a multifaceted network of manufacturing, mobility, logistics, and fleet management partners. Created from industry-leading hardware and software, the Aurora Driver is built to safely move goods and people. Aurora is backed by Amazon and Sequoia, among others, and has partnerships with leading transportation companies including Toyota, Volvo, PACCAR, Uber, FCA, and Hyundai Group. It tests its vehicles in the Bay Area, Pittsburgh, and Dallas and has offices in those cities as well as in Bozeman, Seattle, Denver, and Detroit.
69beb20c-0f1e-4979-a346-4651c5633d36	Awake	https://awakesecurity.com/	Awake Security is the only advanced network traffic analysis company that delivers answers, not alerts. By combining artificial intelligence with human expertise, Awake models and hunts for both insider and external attacker behaviors while providing full forensics across traditional, IoT, and cloud networks for autonomous triage and response. The platform is ranked #1 by EMA for time to value and was recognized as the #1 information security solution being evaluated by global 1000 companies in Enterprise Technology Research’s (ETR) Summer 2019 Emerging Technology Study.
44b0eda3-73ea-412c-a06a-e777781d71b0	AVI Networks	https://avinetworks.com/	Delivering software-defined application services.
b3c4f2c2-3457-4674-9749-69421e385c38	Reduct	https://reduct.video/	Reduct.Video transcribes your team’s recordings and allows everyone to search, edit, and share video — as easily as text.
b5d8a805-c68c-432b-9298-135e197222ab	ResolveAI	https://www.resolve.ai	AI Production Engineer that is on-call and resolves alerts and incidents.
2cbe1630-6f1e-43ee-b059-036590f2c360	Axiamatic	https://www.axiamatic.com/	Axiamatic is the agentic control plane for enterprise transformation. Its platform continuously monitors complex programs, surfaces risks early, and delivers the context and recommendations every stakeholder needs to act — so enterprises can run transformations with the speed, visibility, and predictability that human teams alone cannot achieve.
1b4483c6-8ef4-4788-8833-aa9cf0311577	Baseten Logo NEW 2	https://www.baseten.co/	Baseten empowers the builders shaping the AI economy. Through applied research, production‑grade infrastructure, and a seamless developer experience, customers can infinitely scale open‑source, custom, and fine‑tuned models in production
58651e51-5c1b-4a9f-84ab-ea41db356240	Bedrock Data	https://www.bedrockdata.ai	Bedrock Data is at the forefront of revolutionizing data security in the cloud and GenAI era.
e83319eb-69c8-4d06-ba4f-48d050a576d2	Blend	https://blend.com/	Blend stands for better lending. We’re transforming the $40+ trillion consumer lending industry by creating a fast and simple approach to getting mortgages, consumer loans, and deposit accounts. Our Digital Lending Platform helps financial institutions increase productivity, deepen customer relationships, and deliver exceptional customer experiences. With Blend’s technology, lenders can make the journey from application to close fast and easy for consumers anytime, anywhere.
52119f24-f3ad-46e8-a1bf-87175d5d782e	Blockaid	https://blockaid.io	Blockaid provides an end-to-end solution that can help any company building in the space keep their users safe - including tools like smart contract monitoring, transaction simulation, dApp scanning, token security tools, on-chain and off-chain threat hunting capabilities, and more.
d10b1fe8-8103-42c6-9e2b-f05fc01d3cad	Bretton AI	https://www.bretton.com/	Bretton AI is the leading AI platform for financial crime operations. Regulated banks and global financial institutions trust Bretton AI’s agents to staff mission-critical workflows across KYC, AML, sanctions, and ongoing monitoring. Built on proprietary Trust Infrastructure, Bretton AI enables financial institutions to deploy AI that meets the highest standards for accuracy, explainability, and regulatory alignment.
14042433-f203-4212-8714-321255177ba5	Boost	https://boost.xyz/	Boost is a distributed incentives network. With Boost, anyone can incentivize any onchain action with any token reward. We're unlocking global economic opportunities by building the simplest way to distribute and earn token rewards for completing onchain actions.
0cb6494f-e83a-49d9-abe7-76007a63b196	Braintrust Logo NEW	https://www.braintrustdata.com/	Braintrust is like an operating system for engineers who are building AI software. Developers use Braintrust to evaluate how changes to their code impact end users before they ship, and then incorporate real-world examples back into their evaluations to keep making improvements.
008502f8-c787-4e68-97b9-7ebb6e5d204d	Builderio	https://www.builder.io/	Builder.io is a drag and drop visual builder that works with any site, app, and ecommerce store. It enables digital teams — ecommerce, product, marketing, growth — to move faster by breaking free from constantly relying on developers.
3e3ba3e6-5205-4bd9-bded-d9bfdc64c49a	Caavo	https://caavo.com/	Caavo’s mission is to unite entertainment for people and unite people through entertainment. Founded in 2015 by Andrew Einaudi, Ashish Aggarwal, Vinod Gopinath, and the late Blake Krikorian, Caavo’s technology is protected by more than 80 patents and patents-pending. Caavo Control Center is the first AI-powered smart remote + home theater hub that makes it easy to control everything connected to your TV with one remote.
129e2114-2ea1-4473-9968-c28c54587065	Cato	https://www.catonetworks.com/	Cato is the world’s first SASE platform, converging SD-WAN and network security into a global cloud service. Cato optimizes and secures application access for all users and locations. Cato replaces legacy security products and network services with an agile and secure global network that is ready for whatever’s next.
09a5da71-6d1a-4e2a-8a5b-e423352cc54e	Censys	https://censys.io/	Censys is the trusted provider of Internet security data.
2a068b4b-708c-49d0-b763-deefd3491555	Chia	https://www.chia.net/	Founded by Bram Cohen, the inventor of the BitTorrent network, Chia Network is building a better blockchain and smart transaction platform which is more decentralized, more efficient, and more secure. Chialisp is Chia’s new smart transaction programming language that is powerful, easy to audit, and secure. The blockchain is powered by the first new Nakamoto style consensus algorithm since Bitcoin launched in 2008. Proofs of Space and Time replace energy intensive “proofs of work” by utilizing unused disk space. Chia Network supports the development and deployment of the Chia blockchain globally. Chia Network supports chia developers and supports the enterprise use of chia with software support and chia lending.
0fc99808-b43f-450e-af9c-c94b9c9c31d3	Chronosphere	https://chronosphere.io/	Chronosphere is the observability platform built for control in the modern, containerized world. Recognized as a leader by major analyst firms, Chronosphere empowers customers to focus on the data and insights that matter to reduce data complexity, optimize costs, and remediate issues faster.
af7802d7-3632-4791-bf13-3ebf4a622d83	Cleo	https://hicleo.com/	On a mission to help expecting and new parents succeed at work and at home.
4381695f-9542-4db8-834b-d7094a7f4be1	Clockwise	http://getclockwise.com	Clockwise optimizes teams’ calendars to create more time in everyone’s day.  It helps organizations achieve ambitious goals by creating time for important work and preventing employee burnout.  The company’s mission is to help people make time for what matters, and over 15,000 organizations run on Clockwise, including Atlassian, Uber, Asana, and Reddit.
6ad57bda-91da-4d2b-bf85-fcbbf58a0099	Cloudera	http://cloudera.com	The enterprise data cloud company.
faeddf27-a4c1-4606-a66f-90947dbbada6	coda	http://coda.io	Coda is a new doc for teams. It starts with a blank canvas and a blinking cursor and comes with a new set of building blocksーlike tables that talk to each other, buttons that take action outside your doc, and sectionsーso you have infinite room to grow your ideas.
3212607d-e1bc-482b-bf18-5f445bbfe0a7	Coffee	http://www.coffee.ai/	Coffee is an AI-First CRM for small and medium businesses. Use it as a standalone CRM, or in conjunction with existing CRMs, like Salesforce and Hubspot.
ee629015-ca71-4837-8fef-c483f852dc81	Cogent	https://www.cogent.security/	Cogent Security is the company pioneering the world’s first AI taskforce for vulnerability management. The platform delivers a suite of cross-functional AI agents with expert-level reasoning to autonomously execute time-intensive tasks across the vulnerability management lifecycle. Cogent is transforming vulnerability management for some of the world’s largest and most complex organizations including Fortune 500 enterprises, public companies, and high-profile universities.
025656d8-8a1b-44fb-8308-526eaa6c0a99	Coinbase	http://coinbase.com	Coinbase is the easiest place to buy, sell, and manage your cryptocurrency portfolio. Our mission is to create an open financial system for the world.
5454e6f5-2ec1-4542-ae4d-c8970996b738	common room	https://commonroom.io/	Common Room makes it easy to deepen relationships across your community, anywhere people are.
b7dbf436-3f88-42a8-81e4-fb650aaeb53b	Cresta Logo NEW	http://cresta.com	Cresta is an early-stage enterprise AI startup with the mission of enabling everyone to start as an expert on their first day on the job. Spun out of the Stanford AI lab and chaired by Google-X founder Sebastian Thrun, Cresta brings together industry-leading AI experts, proven leadership, and top-tier investors including Greylock Partners, Andreessen Horowitz, Andy Bechtolsheim, and Mark Leslie. We are in production at multiple Fortune 500 companies and are training on millions of dialog conversations.
b8f9a774-3004-4ae8-99ed-1352659307eb	Crew	\N	\N
c1b9405b-2156-4b6e-9bd4-276aa8d49037	cribl	https://cribl.io/	Cribl is a company built to solve customer data challenges and enable customer choice. Our solutions deliver innovative and customizable controls to route security and observability data where it has the most value. Our solutions help slash costs, improve performance, and get the right data, to the right destinations, in the right formats, at the right time. Cribl helps you instrument everything, so you can analyze more and pay less.
97111662-49c3-4980-b492-a2daf57760cb	Cylake	http://Cylake.com	Cylake is developing a complete, AI-native, data-driven cybersecurity platform intended for on-premises and private environments. The company was founded to address the challenges faced by the world's largest and most regulated organizations and institutions, which demand state-of-the-art cybersecurity but are often unable to use products tied to the public cloud. Cylake is focused on helping these organizations maintain security at scale in a fully sovereign way.
5a8d7105-1c8e-4b5e-9674-45badc2d1417	Dazz	http://dazz.io	Dazz is the leader in cloud security remediation. Our platform maps your code-to-production pipeline across all your cloud environments; collapses your security alerts; identifies root cause and code owner; and tees up a dev-friendly code fix for one-click approval. With Dazz, you massively reduce your alert backlog, improve security posture, and ease tension between security and engineering.
770aaac8-a125-4932-b194-b8b12d7877ea	Demisto	http://demisto.com	Security orchestration, automation, and response (SOAR) platform.
73237cdb-24e4-4bc1-98c8-231d47b01e56	Delphix	\N	Delivering virtual data on demand.
e6149988-c600-4e8d-8824-c25ccef5cd81	Discord	http://discordapp.com	Founder Jason Citron and his team started their company, Hammer & Chisel in 2012. They were building Fates Forever, a new MOBA game for tablets, and were increasingly frustrated by the products they were using to chat while playing their favorite PC games. So in 2015 Jason and Stan Vishnevskiy launched Discord, a communications platform that helps friends come together around the games they love, and it saw immediate adoption and growth. Greylock partnered with Discord in 2016, and today the company has more than 56M monthly active users, with more than 1B messages sent each day.
6a587305-e673-44b1-964f-3a23adcd7c8c	Docker	http://docker.com	The cloud computer engine.
e6edb454-5eac-4418-b6a5-122ae83eb527	Domo	http://domo.com	Business intelligence for the cloud.
0268b22c-612f-4f2e-9d9f-71ab1a3c175f	dropbox	https://www.facebook.com/Dropbox/	Dropbox is building the world’s first smart workspace. We believe there’s a more enlightened way to work. Dropbox helps people be organized, stay focused, and get in sync with their teams.
af46f03a-43b4-4510-a929-37d2e577736b	Entrepeneur First	http://joinef.com	Turning exceptional individuals into exceptional founders.
060ac9f3-7e19-406c-8cec-4c24e90445c2	Espresso	http://espressosys.com	At Espresso Systems, we are building the infrastructure and tools needed for more safe, open, and performant on-chain experiences.
a30f0b27-deeb-4860-a15e-93fce7efeb1f	Fable	https://fablesecurity.com/	Fable Security delivers the human risk platform that directly shapes employee behavior. Designed for simplicity and enterprise scale, our agentic platform synthesizes complex employee data, pinpoints risky behaviors, and deploys highly-relevant interventions to people automatically, in real time, right where they work. With Fable, modern enterprises tangibly reduce risk, sharpen security habits, and drive lasting organizational resilience.
83838f31-351e-44cb-8d62-8c41c47f2de6	facebook	http://facebook.com	Facebook is an online social networking service that allows its users to connect with friends and family as well as make new connections. It provides its users with the ability to create a profile, update information, add images, send friend requests, and accept requests from other users. Its features include status update, photo tagging and sharing, and more.
1053bc5a-4805-4c31-b017-e8311ae36efc	fermat	http://www.fermatcommerce.com	FERMÀT is the next generation of influencer driven e-commerce, where influencers and brands collide. FERMÀT provides the tooling and the network to enable distributed commerce. We help brands easily embed shopping experiences in influencer content, so the influencer’s audience has a native, engaging shopping experience.
996a65e5-4253-4217-b3bb-ac1046ec5add	figma	http://figma.com	Figma is a design platform for teams who build products together. Born on the Web, Figma helps the entire product team create, test, and ship better designs, faster.On a mission to make design accessible to all, Figma is helping companies like Microsoft, Google, and Slack redesign how they design. Whether you’re trying to consolidate tools, get more eyes on your work, or collaborate across time zones, Figma boosts creative productivity while keeping everyone on the same page.
2e5b1795-c288-4548-be57-c5c05b4b5dbe	Frec	https://frec.com/	We believe everyone deserves access to better and smarter ways to manage their money. At Frec, we are transforming complex financial products that have traditionally been available through wealth advisors into automated, easy-to-use technology.
f26b39b5-bf4a-4ca8-a08b-2eea4ea8ca61	gem	http://gem.com/	Gem is an all-in-one recruiting platform that integrates with LinkedIn, email, and your Applicant Tracking System (ATS). We enable data-driven, world-class recruiting teams to find, engage, and nurture top talent. With Gem, recruiting teams can manage candidate pipeline with predictability.
9c215f93-55d3-484c-acff-2576d1b5c058	gladly	http://gladly.com	Gladly is a radically personal customer service platform. Unlike legacy customer service platforms that are case centric, only Gladly is designed with people at the center and uniquely enables a single lifelong customer conversation from voice to modern messaging. Gladly powers some of the most innovative consumer companies like JetBlue, Porsche, Tory Burch, JOANN, and TUMI to deliver exceptional customer experiences and makes customer service a competitive advantage
410311df-5e3f-4546-a6f3-c9a0d02e2ee7	GoFundMe	https://gofundme.com	GoFundMe is the world’s largest and most trusted free online fundraising platform that makes it easy to help others and turn compassion into action. The GoFundMe community has raised over $9 billion from more than 120 million donations for people, causes, and organizations. GoFundMe is changing the way the world gives.
3517c8a1-17de-4b5e-8537-19f13ebb4bd7	gretel	https://gretel.ai	Gretel’s open platform enables developers to build quickly with data and safely share it with others. With Gretel, developers are able to anonymize sensitive data by generating synthetic data from it — artificial data that closely matches the original data, but is safe to share.
fcb2f5f9-7707-4d4c-bf86-c83ee51880e2	Handshake	https://handshake.org/	Handshake is a decentralized, permissionless naming protocol where every peer is validating and in charge of managing the root DNS naming zone with the goal of creating an alternative to existing Certificate Authorities and naming systems. Names on the internet (top level domains, social networking handles, etc.) ultimately rely upon centralized actors with full control over a system which are relied upon to be honest, as they are vulnerable to hacking, censorship, and corruption. Handshake aims to experiment with new ways the internet can be more secure, resilient, and socially useful with a peer-to-peer system validated by the network’s participants.
523157f5-4b51-4d1b-a097-a1755eb5f167	Highstock	https://www.highstock.com/	Highstock is the leading technology platform for brands with unsold inventory to find trustworthy global wholesale buyers.
9faed36f-33fa-49c4-b32b-824868d07a07	hoist	https://www.hoistup.com/	We’re the first technology startup introducing the business in a box concept to home services. We’re everything you need to start, run and grow a successful business from scratch.
86c5619b-27d8-482c-bd57-422da2a72f96	houseparty	https://www.houseparty.com/	Synchronous Social Network with the mission to bring empathy back to online communication.
f4e1e32f-dba8-45c0-aa8e-ec9bbe54d228	Included Healthcare	http://includedhealth.com/	Included Health is raising the standard of healthcare for everyone. We break down barriers to care with a personalized, end-to-end healthcare experience for every person in every community — no matter where they are in their health journey. We partner with employers and health plans to deliver better outcomes. With compassionate, data-driven guidance, advocacy, and care for all types of health needs, Included Health gets our members the right care at the right time. It’s all included.
feb29bb7-e7d6-43f5-b4c1-299b00f7669f	inflection	http://www.inflection.ai/	Inflection is an AI studio, incubated at Greylock. Inflection is driven by a simple mission: to create a personal intelligence for everyone.
b942e2b4-1a17-4fec-a8ef-388ee3a02d5e	innovium	http://innovium.com	Innovium is a leading provider of high performance, innovative switching silicon solutions for Cloud and Edge data centers. Innovium TERALYNX family delivers software compatible products ranging from 1Tbps to 12.8Tbps with unmatched telemetry, low latency, programmability, and large buffers, and a feature rich architecture that scales to 51.2Tbps+. Innovium’s products have been selected and validated by market-leading switch OEM, ODM and cloud providers. The company is headquartered in Silicon Valley, California and is backed by leading venture capital firms including Greylock Partners, Walden Riverwood, Capricorn Investment Group, Qualcomm Ventures, S-Cubed Capital and Redline Capital.
67b4f98c-acd2-477b-80ed-254c461fbb99	instabase	http://instabase.com	Instabase provides customizable solutions, and the building blocks to make them, for companies seeking to automate document-driven business processes.
652610a7-100f-4491-9772-32c51d08534f	instagram	http://instagram.com	Fast beautiful photo sharing.
f55da11a-d7c1-45c1-afce-b7e40f58c80c	Instawork	http://www.instawork.com/	Instawork is the leading flexible staffing solution for local, hourly professionals. Its digital marketplace connects thousands of businesses and more than one million workers in the U.S., filling a critical role in local economies. Instawork helps businesses in food & beverage, hospitality, and warehouse/logistics industries fill temporary and permanent job opportunities in more than 25 U.S. markets.
65802d4c-7e94-48c9-9d78-5e6dca66855c	inventa	https://inventa.shop/	Inventa is a B2B marketplace that connects brands and retailers on a easy to use platform, offering a comprehensive portfolio at suitable prices, empowering and supporting them to grow their business with less financial risk.
166d5ab3-5a7e-4669-8339-ca90185d168a	Kodem	https://www.kodemsecurity.com/	Kodem is redefining application security for fast-moving teams. Kodem Dynamic™️ is the industry’s only software composition analysis platform that uses runtime intelligence to determine actual application risk. Founded by veterans of elite cybersecurity organizations who have decades of combined experience in security research and innovation, Kodem helps AppSec teams gain deep application understanding, tune in to the signals that matter, and streamline remediation of the most critical issues.
dffd6829-fce3-494b-86eb-4c051efbf050	Lapse	http://lapse.com	Lapse transforms your iPhone into a camera for living in the moment and photo journal for close friends.
bae1e8b5-98a6-4ec0-8585-03bdf0aba42d	Lightfield	https://lightfield.app/	Lightfield is a next-generation CRM that automatically captures every customer interaction—from emails and meetings to support tickets—and turns them into structured, queryable data. Built for fast-growing AI-native companies, Lightfield enables both humans and agents to understand and serve customers with complete context.
d1f58d13-f732-4509-98bb-e9b4bce979c0	linkedin	\N	With millions of jobs on LinkedIn, find one meant for you.Founded in 2003, LinkedIn connects the world’s professionals to make them more productive and successful. With more than 675+ million members worldwide, including executives from every Fortune 500 company, LinkedIn is the world’s largest professional network and leads a diversified business with revenues from membership subscriptions, advertising sales and recruitment solutions. In December 2016, Microsoft completed its acquisition of LinkedIn, bringing together the world’s leading professional cloud and the world’s leading professional network.
c5a3e85f-772d-4c57-86d5-200287ffbc19	lithos	https://www.lithoscarbon.com	Carbon removal using the power of enhanced rock weathering. We accelerate mineral weathering by spreading basalt on croplands to increase dissolved inorganic carbon with eventual storage as ocean carbonates. Our technology uses novel soil models and machine learning to maximize CO₂ removal while boosting crop growth.
d3482119-1b21-4c9b-b932-bee08554e2bd	LlamaIndex	http://llamaindex.ai/	LlamaIndex offers a practical toolkit that empowers any developer to unlock the full capabilities and use cases of LLMs on top of their own data. It can be used with any LLM and offers an easy to use and optimized experience. The toolkit can handle a diverse range of data sources, from structured to semi-structured to unstructured text or even image data, and includes data ingestion, data indexing, and a query engine layer on top.
bd3a8cf5-dccf-480c-a45b-633974300085	Lyra	http://lyrahealth.com	Lyra helps companies improve access to effective, high-quality mental health care for their employees and their families. With Lyra’s digital care platform and elite network of coaches, therapists, and psychiatrists, finding care is easier, more personalized, and more effective. Lyra has raised more than $170 million and works with large employers, such as Starbucks, uber, Amgen, LinkedIn, and Fortune 500 companies to support more than 1 million members nationwide.
66d11e12-dd53-4bf8-a695-f07d72c87f02	magic eden	https://magiceden.io/	Magic Eden is the #1 NFT marketplace on Solana. Our mission is to be the destination for discovering, trading, and creating NFTs. In its first two months since launch, Magic Eden has done ~$200M in trading volume to become the dominant NFT platform on Solana.
ec2a479c-cf04-4ecc-a6b0-47534b6e093a	Magical	https://www.getmagical.com/	With no integrations and just a simple keystroke, Magical can move data across your websites and apps, speeding up workflows like messaging, data-entry, populating spreadsheets and more. Over 10,000 businesses use Magical today with the average user eliminating approximately seven hours of work a week after integrating Magical into how they work.
de0ded28-6b05-497b-abf7-356148fa38a1	Mammoth Media	http://mammoth.la	Mammoth Media is the mobile entertainment studio that produces, distributes and monetizes original short-form content across its owned & operated apps that engage more than 30 million monthly Generation Z consumers. It is behind the social polling app Wishbone, interactive storytelling app Yarn, and media summaries app CatchUp.
bea5071d-50c3-48d8-a117-435da008bcb7	Mandolin	https://www.mandolin.com/	Mandolin is the leading AI automation platform for specialty drug access. The company’s AI agents act just like a best employee, completing tasks like reasoning about clinical policies, calling payers, parsing faxes and handwritten notes, and making decisions across entire workflows.
ddf3134d-6e88-482e-a8e3-4853e0ff05f0	Medium	http://medium.com	Medium is a subscription publishing platform with 120 million monthly readers. It delivers journalistic rigor alongside insights from thousands of publications and diverse voices from across the web in an elegant, personalized, and entirely ad-free experience.
eb476fc1-66ce-4031-8319-a2a8bb4ee67e	Modular	https://www.modular.com/	Modular’s vision is to enable AI to be used by anyone, anywhere. We believe that the future of AI will be powered by production-quality infrastructure that unifies AI software and hardware with a “just works” approach, providing higher performance at lower cost and accelerating developer velocity across any framework, any hardware, any cloud. We believe that AI is a net positive force in the world and will help transform it for the better.
f49d07a5-e7a2-45fe-beaf-0609d7a12532	Multi	https://multi.app	Multi is a video workspace designed for faster, more connected remote work. It helps teams talk live instead of typing or scheduling a meeting.
58d0aa61-9d4d-41f1-8b3e-792207336c15	musically	https://musicallyvideos.com/	Instant music video.
e64d2f47-0818-4979-b7c9-d124bbe9f7f0	Natoma	https://www.natoma.id/	Natoma is a platform to secure and manage all non-human identities (NHIs - e.g. service &  application accounts, API keys, OAuth & access tokens, certificates & machine IDs). Within minutes Natoma can discover NHIs and start to manage their ownership and lifecycle.
d95a4f4b-ae61-4788-afce-f097fbf7d8e6	nauto	http://nauto.com	AI-powered driver behavior modification technology.
58ae88a8-7e8c-424a-a050-dcbcd1da8590	neeva	http://www.neeva.co	Neeva is the world’s first completely ad-free, private search engine. We help our users find exactly what matters to them, whether that information is on the web, in their buried emails or in an impossible-to-find document. We never show distracting ads, and we keep all searches private. Neeva is building a digital world that revolves around people — not advertisers.
3c6326af-03a9-4678-8c6a-918e7be58b04	Netic	https://www.netic.ai/	Netic combines real-time AI agents with automated marketing campaigns to capture every potential lead across calls, texts, online widgets, and third party channels, and proactively uncovers new prioritized opportunities to dramatically boost revenue.
bf572d60-98b1-48a0-ada8-421ff697cc7a	Nextdoor	http://nextdoor.com	Nextdoor is the neighborhood hub for trusted connections and the exchange of helpful information, goods, and services. Nextdoor’s purpose is to cultivate a kinder world where everyone has a neighborhood they can rely on. Neighbors rely on Nextdoor in the United States, the United Kingdom, Germany, France, the Netherlands, Italy, Spain, Sweden, Denmark, Australia, and Canada.
304faa34-9926-4622-a17d-2c90e765f2b0	Niteshift	https://niteshift.dev/	Niteshift helps companies capture the productivity gains of agentic software development. Its platform gives coding agents the runtime, context, compute, and verification loop they need, so teams can ship faster, reduce backlog, and expand who can contribute to building software.
a4f50f4a-cf11-455a-bd00-e4ff551ff7bd	Notable	https://notablehealth.com/	As health care shifted from paper to digital, administrative overhead grew to 8x that of any other industry – plagued by clicks, manual tasks, error prone workflows, and systems that don’t interoperate. Notable helps forward thinking health organizations automate from the front desk to the back office, using digital assistants and intelligent automation.
ab09cae8-b19d-4a48-adb0-7ba24d8b41d1	novi	https://www.noviconnect.com/	Novi is the infrastructure powering brand growth in AI commerce. By connecting brands, certification bodies, and major retailers, Novi ensures verified product data is accurate, consistent, and surfaced where shoppers and AI models search—turning credibility into authority, visibility, and conversion.
cf169017-7684-4523-9492-4875bbfdf946	Nuro	https://nuro.ai/	Nuro is a self-driving technology company making autonomy accessible to all. Founded in 2016, Nuro is building the world’s most scalable driver, combining advanced AI with automotive-grade hardware. The Nuro Driver™ powers applications from robotaxis and commercial fleets to personally owned vehicles. With years of proven deployments, Nuro gives automakers and mobility platforms a clear path to autonomy at scale. Through its partnership with Lucid and Uber, Nuro is preparing to deploy a next-generation robotaxi program with more than 20,000 vehicles across U.S. and international markets.
ca74afb5-ded0-4ba0-9725-c568ddd962bc	oak network	https://oak.tech/	OAK Network’s innovation, the event-driven transaction, allows users to create bespoke on-chain automation not possible today. Incumbent “automation” solutions are not consumer-friendly, requiring coding knowledge, AWS servers, and private key delegation. OAK’s more powerful transaction shifts the paradigm of automation from centralized servers to the blockchain. With OAK, users are empowered to schedule future and recurring payments, engage in trustless auto-trading, and place decentralized limit and stop-loss orders on AMM DEXs all without smart contract middlemen or compromising the security of a user’s wallet.
9fe2047c-e1a1-4e88-9085-102f52015563	Obsidian Security	https://www.obsidiansecurity.com/	Enterprise hybrid-cloud cybersecurity.
e1a5d900-d2db-452c-bb44-5d35bd3e1942	Okta	http://okta.com/	Okta is the leading independent provider of identity for the enterprise. The Okta Identity Cloud enables organizations to securely connect the right people to the right technologies at the right time. With over 6,500 pre-built integrations to applications and infrastructure providers, Okta customers can easily and securely use the best technologies for their business. Nearly 8,000 organizations, including Engie, JetBlue, Nordstrom, Takeda Pharmaceutical, Teach for America, T-Mobile and Twilio, trust Okta to help protect the identities of their workforces and customers.
e49ff184-4f7f-452e-9aca-6e665ee83e81	Onehouse	https://onehouse.ai/	Onehouse delivers a new bedrock for your data, through a cloud-native managed lakehouse service built on Apache Hudi, which was created by the founding team while they were at Uber. Onehouse makes it possible to blend the ease of use of a warehouse with the scale of a data lake, by offering a seamless experience for engineers to get their data lakes up and running.
d54eb0a9-70fe-4c1c-a594-0ff793649149	Opal Security	https://opal.dev/	Opal is the leading modern identity security platform. We provide the automation and orchestration workflows necessary to leverage identity and implement least privilege at scale. The world’s best companies from Fortune 500 to forward thinking startups trust Opal to govern, adapt, and remediate risky access at scale.
c863df8c-d38c-4fd3-82e3-e60b99bf6583	OpenAI	https://openai.com/	OpenAI is an AI research and deployment company dedicated to ensuring that general-purpose artificial intelligence benefits all of humanity. AI is an extremely powerful tool that must be created with safety and human needs at its core. OpenAI is dedicated to putting that alignment of interests first — ahead of profit.
37719dca-68ef-4f32-a110-79d5dbe19d0a	OpenDNS	https://www.facebook.com/OpenDNS	Internet infrastructure security and services.
459be105-8cc4-4544-adee-9b346ae1d897	Oportun	https://oportun.com/	Oportun is a high-growth, mission-driven Community Development Financial Institution (CDFI). Oportun provides inclusive, affordable financial services powered by a deep, data-driven understanding of its customers and advanced proprietary technology. By lending money to hardworking, low-to-moderate-income individuals, Oportun helps them move forward in their lives, demonstrate their creditworthiness, and establish the credit history they need to access new opportunities. Oportun serves customers in English and Spanish; online and over the phone in 19 states, and in person at more than 300 retail locations across 12 states.
e504622c-89a2-4d9d-a0fe-13fb42e87016	Optic	https://www.optic.inc	Optic Inc., an AI drug discovery company, creators of Bioptic.io — a proprietary ligand-based molecular search AI. Bioptic identifies small molecules by their activity-expressing fingerprints, assisting drug hunters in discovering a diverse set of candidates. Our pipeline includes three pre-clinical stage programs, showcasing our commitment to practical, AI-driven solutions in cancer therapy.
a94436ff-c313-4727-89da-2cf701b7af0a	orb	https://www.withorb.com/	Orb is the modern pricing platform purpose-built for flexible pricing models.We help companies automate billing and enable pricing strategy experimentation, essential in this macro climate of rapid change and focus on revenue efficiency.Orb is the only platform that spans the end-to-end revenue workflow, from collecting and metering product usage data, to flexible pricing and packaging iteration, to streamlined invoicing, to reporting and revenue recognition.
6a3ed9ef-3005-4c83-951f-5c0f11478b3c	PaloAlto	https://www.youtube.com/user/paloaltonetworks	Palo Alto Networks is the world's cybersecurity leader. We innovate to outpace cyberthreats so organizations can embrace technology with confidence. We provide next-generation cybersecurity to thousands of customers globally, across all sectors. Our best-in-class cybersecurity platforms and services are backed by industry-leading threat intelligence and strengthened by state-of-the-art automation. Whether deploying our products to enable the Zero Trust Enterprise, responding to a security incident or partnering to deliver better security outcomes through a world-class partner ecosystem, we're committed to helping ensure each day is safer than the one before. It's what makes us the cybersecurity partner of choice.
c8f42c99-1bcb-42cf-bcc4-b15fef379cba	pandora	https://www.pandora.com/	Internet music and radio discovery service.
70cee19a-cf2f-4d06-9208-a33c6833a62c	Paramark	https://paramark.com/	Paramark is a platform that gives marketing teams the ability to measure the true incremental impact of their investments and make spending decisions with confidence.
dd8f56e7-a0c5-41c8-8d74-19b06d6704cf	payjoy	https://www.facebook.com/PayJoyInc	PayJoy’s mission is to unlock access to technology and credit for billions of people in emerging markets. We partner with leading retailers, lenders, and device manufacturers around the world to help them reach new customer segments.
48390061-bb7c-4bee-a65a-5901c619d78f	Pepper	http://www.usepepper.com	Pepper is the eCommerce platform for food distributors. Thousands of restaurants, grocery stores, and convenience stores, across N. America, order from their distributors on an ordering system that’s powered by Pepper. On average, food distributors using Pepper see 14% sales growth and 77% reduction in order entry time.
32033c79-164b-4378-844d-361529bf7f43	pinata	https://www.pinata.cloud/	Pinata’s mission is to help creators provide an experience worth paying for.
e83d809e-5b6f-43e9-8d39-b2a74273a7b7	pine	https://www.pine.ca/	Pine is transforming the outdated and complicated home financing process in Canada by creating a simpler, faster, and better experience. We believe getting a mortgage shouldn’t take away from the joys of owning a home and are using technology to enable a fully digital, low cost, direct to consumer option.
360f1e35-dadd-4715-9572-d68b2b745fc3	portals	https://theportal.to/	A web-based metaverse built on the Solana blockchain. With a focus on a dense city center and zero-friction UX, Portals is an immersive social space where you can explore, build, and gather with others. With easy build tools and built-in communication features, players can customize immersive virtual spaces and experiences—such as residences, offices, or storefronts—in a downtown metropolitan area. Players gather, collect, build, explore, participate in economic activities, form communities, play user-built games in the arcade, and work towards building the best city in the metaverse.
a30b52d5-d5cd-4076-afda-a8ad19d391eb	Postscript	http://www.postscript.io	Postscript is the leading ecommerce SMS platform that enables brands to communicate and engage with customers through text message marketing. Built to connect directly with Shopify and Shopify Plus merchants, Postscript provides technology for brands to segment lists, create deep data flows, and respect the inbox of consumers.
3adc91aa-0226-44d8-8a8f-c8d7a1b5740b	Pragma	https://pragma.gg/	Pragma makes it easier, more affordable, and more scalable for game developers to launch new games by providing a “backend as a service” solution.
bfe690f1-2da1-40d1-afc7-55b347f58ae7	predibase	https://predibase.com/	Predibase puts state-of-the-art machine learning in the hands of data practitioners, using a new declarative approach pioneered by the founding team at leading companies like Uber and Apple. Built on top of open source foundations of Ludwig and Horovod, Predibase allows users to focus on the “what” of their ML models and allows the system to determine the “how” as users go from data to deployment of machine learning.
d3da6759-449a-4d9b-8c21-38f564e078e5	pure storage	https://www.youtube.com/user/purestorage	Cost-effective enterprise flash storage.
cec971f0-2364-4d55-88cb-75b62ef6b7ac	Quip	https://www.facebook.com/quip	The modern productivity suite.
831332e7-942f-477a-afa2-2a1bd6261847	Ramp	https://ramp.com/	Ramp is rebuilding the CFO suite with a unified platform– combining corporate cards, expense management, vendor management and price intelligence, procurement, bill payments, and accounting integrations– that delivers tangible, immediate time and money savings for businesses. Over 15,000 businesses have switched to Ramp to cut their expenses by an average of 5% and close their books 8x faster.
d9339692-3e93-4d0c-8af0-bc481f11cc15	Red Hat	http://www.youtube.com/user/RedHatVideos	Open source software, solution, services.
7e971505-8d9e-41c4-92b9-999239693cc1	redfin	https://www.facebook.com/redfin	Customer-first real estate brokerage.
62bab1bc-06e2-4c6b-9632-98bc3c133ee7	Responsiv	https://responsiv.ai/	Responsiv is the copilot for legal know-how. Specifically designed for in-house attorneys, it cuts down on research time by providing direct, verifiable answers. With its natural language processing capabilities, it offers information tailored to user queries and fact patterns that you can trust.
cd2d474e-72c5-4a51-9d7b-95a4c0d4141d	Rhumbix	https://www.facebook.com/Rhumbix/	Rhumbix is transforming the way construction teams capture, share, and analyze project performance in the field. The Rhumbix Field Data Platform enables teams to simplify and streamline critical field workflows like timekeeping and time & materials tracking, eliminating static, paper-based reporting. Through these data-rich field insights, construction teams have easy access to centralized project reporting, connected workflows, and software integrations built for the way they work. Save time and increase productivity on the jobsite with the Rhumbix Field Data Platform.
549bdc67-9e62-4a0f-a668-0c0e4d77649a	Rockset	http://www.facebook.com/RocksetCloud	Rockset is a real-time database in the cloud. It builds real-time converged indexes on transactional data from other databases and event data from streams, and supports schemaless ingest, built-in transformations and declarative SQL over REST. It is used for building data applications that make intelligent decisions on real-time data.
72f1a0aa-b557-4f96-8be7-ffda7e0d97f1	Rubrik	https://www.rubrik.com/en	Rubrik is on a mission to secure the world’s data. The company sits at the intersection of data, security, and AI. Founded in 2014, the cybersecurity company helps ensure organizations can operate in the presence of cyber attacks. Rubrik pioneered a platform of Zero Trust Data Security™ to provide cyber resilience amid all forms of cyber events including ransomware. Greylock’s partnership with Rubrik was early, in 2015, before the company’s first products were market-ready. Today, Rubrik’s Data Security Cloud delivers industry-leading cybersecurity and secures customers' data across enterprise, cloud, and SaaS applications. The company is a global leader with more than 5,000 global customers and more than $500M in ARR.
4d546b6f-0ce1-49d3-a327-b4ce06529f24	servicenow	https://www.servicenow.com/	ServiceNow digital workflows let employees work the way they want to, not how software dictates they have to.
f036ae24-50b6-4b70-aa08-8be528938f89	Shortcut	http://shortcut.com/	Shortcut (formerly Clubhouse Software) is the collaborative home for modern software teams that is fast, enjoyable, loved by developers, and easy-to-use so teams can work cross-functionally on what matters: building products that their customers love. Thousands of companies around the world use Shortcut to plan, collaborate, and build better software together.
1a0b6a8c-aaec-4920-b222-8d687718dedc	Skyhigh	https://www.skyhighnetworks.com/	Discover, analyze & control the usage and risk of all your cloud services.
09b8626e-b19b-4459-af2b-9972438cf58e	Snorkel	https://www.snorkel.ai	Founded by a team spun out of the Stanford AI Lab, Snorkel AI’s mission is to make AI practical with a first-of-its-kind data-first machine learning platform, Snorkel Flow. Snorkel Flow uses a new programmatic approach to building and managing the training data that fuels AI, saving organizations time and enabling them to apply AI to new problems.
d8565df7-e2fc-4253-a1e5-1bd0a0dcb324	solv	https://www.solvhealth.com/	Convenient health care booking and cost transparency app.
9aed0db5-3982-4e24-ae90-7d542940dfa2	Sonder	https://www.sonder.com/	Beautiful spaces built for travel and life.
f9c5dd26-5184-465b-8436-5a733b3052ba	sqreen	https://www.sqreen.com/	Sqreen is the application security platform for the modern enterprise. More than 800 organizations trust Sqreen to protect, observe and test their applications, APIs and microservices. As opposed to pattern-based approaches, Sqreen analyses in-app execution in real time to deliver more robust security without compromising performance.
a4eb68c9-1b46-4704-a44f-df3dd76651e3	Stackblitz	https://stackblitz.com/	StackBlitz is on a mission to bring web development into the browser. Trusted by over 2M developers every month who use StackBlitz for learning, collaboration, open source projects, and at work on world-class development teams.
e3cb9ab4-7993-41a6-bcc0-dd5538275e44	Sumo Logic	http://sumologic.com	Sumo Logic is a leader in continuous intelligence, a new category of software, which enables organizations of all sizes address the data challenges and opportunities presented by digital transformation, modern applications, and cloud computing. The Sumo Logic Continuous Intelligence Platform™ automates the collection, ingestion, and analysis of application, infrastructure, security, and IoT data to derive actionable insights within seconds. More than 2,000 customers rely on Sumo Logic to build, run, and secure their modern applications and cloud infrastructures.
d76b5464-8b23-41d5-aa06-48292db60024	SuperMe	https://superme.ai/	With SuperMe, professionals can share their perspectives on topics they are experts in, and users can get instant insights and advice from professionals they admire. SuperMe profiles are trained on a professional’s content, and professionals can see everything a user asks them, and can share additional insight with a user 1:1. Users can chat directly with a profile, or use the search functionality to get insights from the best professionals on a topic.
790208a3-8a90-44fc-b8b9-8484fb5eaca0	Tellapart	\N	Predictive customer analytics.
c60650fa-c3d7-4b03-9612-b8c5f9ce1aa6	Tenzai	https://www.tenzai.com/	Tenzai is an AI-native cybersecurity company building cutting-edge AI hackers to ensure enterprises deliver unbreakable code. Its platform actively hacks, exploits, and helps fix vulnerabilities across enterprise software - continuously and at scale.
d5c28922-82c0-43b7-9e38-67deba996f32	Tin Can	https://tincan.kids/	Based in Seattle, WA, Tin Can was founded with a simple belief: connection doesn’t have to be complicated to be meaningful. The Tin Can is a landline, reinvented for friends—a screen-free, ad-free, text-free phone that allows kids to stay in touch while encouraging real conversation and independence. Equipped with modern safeguards, the phone operates on a fully private network (only approved callers can call in) so parents get peace of mind and kids get a fun, safe way to chat with friends and family.
cd04d884-3b1e-4909-bebe-2dfca6abeb5e	truera	https://www.truera.com	Truera provides the first Model Intelligence platform, to help enterprises analyze machine learning, improve model quality and build trust. Powered by enterprise-class Artificial Intelligence (AI) Explainability technology based on six years of research at Carnegie Mellon University, Truera’s platform helps eliminate the black box surrounding widely used AI and ML technologies. This visibility leads to higher quality, explainable models that achieve measurable business results, address unfair bias, and ensure governance and compliance.
3992b094-caf6-49dd-af2a-4664c0f44196	Tydo	https://www.tydo.com/	Tydo organizes complex data for DTC brands into rich and intuitive dashboards. Data that you can use to make clear decisions and take deliberate action on. Data that moves with the currents of your business.
a0af367e-ad13-4e8d-bf9c-32c6e75bded2	Uplimit	https://uplimit.com/	CoRise is on a mission to upskill the world’s workforce, achieving quality at scale by leveraging community and technology. While the need for upskilling and reskilling has accelerated in recent years, solutions have not kept pace. Completion of asynchronous courses remains woefully low (4-6%), and live courses are challenging and costly to scale across large organizations. CoRise offers a needed alternative—cohort-based professional courses with industry-leading engagement and career-changing impact that can scale to thousands of learners.
4e8ba09c-4df6-43b6-ad04-5ffdab3190e1	Upwind	http://www.upwind.io	Upwind is the runtime-powered CNAPP that protects everything you run in the cloud with real-time insights. Upwind discovers what your cloud infrastructure and applications are actually doing in real time, and allows you to stop threats and proactively fix security risks before they can be exploited.Upwind is giving thousands of hours back to security teams and optimizing security budgets by prioritizing and responding to the most important risks and threats.
94806c6c-2f31-4045-a1d2-81f7ada9ab4e	Validere	https://validere.com/	Validere is optimizing the global energy industry through data transparency. It enables industry participants to make better logistics and trading decisions through accurate and timely product quality insights. Validere is creating a system of record for product quality in oil and gas, which unlocks both industry-wide efficiency and environmental waste reduction.
989e9e98-f4ed-4c1c-be42-eec6c9433294	Vori	https://www.vori.com	Vori makes supermarkets more efficient by connecting data across the food supply chain and digitizing workflows and analog data.
bba901ce-3969-463f-b730-df718a9b1044	WarpStream	https://www.warpstream.com/	WarpStream provides a drop-in replacement for Apache Kafka that runs directly on top of object storage, with no local disks.
f348e8b7-b9bf-4bc0-93f5-9d62b139c61b	wealthsimple	https://www.wealthsimple.com/en-us/	Wealthsimple is a financial company on a mission to help everyone achieve financial freedom by providing products and advice that are accessible and affordable. Using smart technology, Wealthsimple takes financial services that are often confusing, opaque and expensive and makes them simple, transparent, and low-cost.
24b8298a-c57e-4d73-91e7-7eb3e92f988d	wisetack	https://www.wisetack.com/	Through its suite of APIs, Wisetack embeds financing options into software platforms that thousands of businesses already use in their day-to-day operations. With Wisetack, in-person businesses can offer financing to consumers in minutes, while consumers can pay over time for purchases without surprises or unexpected fees.
562b2b1f-2028-4a0c-846c-2532ab95a6f7	Wiz	https://www.wiz.io/	Wiz transforms cloud security for customers – including 40% of the Fortune 100 – by enabling a new operating model. Our CNAPP empowers security and development teams to build fast and securely by providing visibility into their cloud environments. With Wiz, organizations can prioritize risk and stay agile.
3a8e244d-d549-456b-bf02-a98745991e99	Workday	https://www.workday.com/	Workday is a leading provider of enterprise cloud applications for finance and human resources. Founded in 2005, Workday delivers financial management, human capital management, planning, and analytics applications designed for the world’s largest companies, educational institutions, and government agencies. Organizations ranging from medium-sized businesses to Fortune 50 enterprises have selected Workday.
3c7eb52c-c17a-41fb-980f-408b7a2f4d17	Xapo	https://www.youtube.com/channel/UC4MCNbUPZxhq1p6jZoCeUUA	Xapo has evolved from the world’s largest Bitcoin custodian to an international private bank that is focused on protecting and growing wealth for its members in emerging markets. Xapo offers US Dollar and Bitcoin accounts, and pays an annual interest on both types of deposits.
5b37cf16-275a-4390-9eb0-9980cb5f0bed	Zuora	https://www.youtube.com/user/ZuoraInc	On-demand subscription commerce and billing solutions.
a5c7a498-70e4-49ca-84ce-3d2e85ee91cc	roblox	https://about.roblox.com/	Roblox’s mission is to bring the world together through play. We enable anyone to imagine, create, and have fun with friends as they explore millions of immersive 3D experiences, all built by a global community of developers.
cb844f0e-b0b1-4cb8-b1a3-33826e9ab29d	Abnormal Security	\N	\N
559597bc-8061-4b01-a0d7-77b3ffc055bf	Palo Alto Networks	\N	\N
1b27594e-123d-4517-acdf-ecdfa98a3b53	Awake Networks	\N	\N
fd3cb59b-2712-401b-93f6-786a66715d52	Imperva	\N	\N
cd8bb90c-18e9-450a-b5cd-c68241e42d2c	Skyhigh Networks	\N	\N
2d022f26-4a79-4c7e-b03a-596ffac71577	Aquantia	\N	\N
4ad5b397-d2db-4484-b36a-7bd02f296a80	TechProcess	\N	\N
d3151bf5-82f2-4977-980e-172bea201bfc	Arista Networks	\N	\N
8c0aad18-f3d2-46f0-8170-9268beb74128	Zenprise	\N	\N
ff3ef1c6-50b0-4691-a70c-927ffa4dc5e6	Sourcefire	\N	\N
befbfb86-355f-489b-bc93-5d5174fee706	Xsigo Systems	\N	\N
1c6c67ed-77e8-4c8b-94f7-c820ba9c94b4	Aruba Networks	\N	\N
4dbaf686-b525-426d-9b56-0dd67b7d2a06	PortAuthority Technologies	\N	\N
4b608283-f22e-4158-b3e3-770e41191fb0	Securent	\N	\N
5ae509c7-e688-4396-9675-4f7d6b714891	CipherTrust	\N	\N
7f527b5b-5026-4c71-abfd-b30fc224ff4d	Netboost	\N	\N
0e58ae00-a3fd-44f8-bd10-587d3e39c707	Cato Networks	\N	\N
da7cc546-3a02-40e4-9489-ac1ea9ccd568	Notable Health	\N	\N
555b6456-a949-45b8-9b6c-0183767fb0ea	atSpoke	\N	\N
e25ad2cb-986f-4cb3-b889-09576fba016d	Attic Labs	\N	\N
0379335a-58ef-4280-8f29-7f40ab0c0b96	Builder	\N	\N
7a69bae5-2fde-4841-b3f3-88dfbe8f8739	District	\N	\N
3f0f0773-dc6f-40df-89a4-aa5051f1127b	Tenor	\N	\N
74f88cb8-6ba3-4016-a6ce-1c236a0f7f07	Blockstream	\N	\N
a4227b7f-6550-4995-b7a2-23f452475f02	Convoy	\N	\N
47db18c5-c134-4c7d-b816-b210bdecf4d9	Entrepreneur First	\N	\N
dd35fe52-3a16-4023-a6bf-8e8f93ab1509	Tome	\N	\N
1c8008c7-0e85-4f6a-b8a5-c43bb5be947d	Coupons.com	\N	\N
a0ac9209-b4ad-4c65-9af6-1723ee2b4bb7	Edmodo	\N	\N
20666127-e71e-4b23-8e30-322c73732547	Shopkick	\N	\N
e4ada4da-729e-4a5b-b14a-f0f37e5a1947	TrialPay	\N	\N
173dd2e7-4b0a-4044-af02-f69b0a016c63	Viki	\N	\N
032f1d33-734f-4994-a3b7-44f5636c07a9	Braintrust	\N	\N
3a0be0bf-afcd-4f3b-b1bf-a2cc65cab3d2	Cogent Security	\N	\N
1b20237d-3d73-4e59-bc5f-db6bc5993ef5	Cresta	\N	\N
a2c4a9ed-3a8d-4102-87ed-d00c734cb033	Fable Security	\N	\N
9e8eee0a-c88e-4085-9ec1-fc9f942f3f6a	Natoma Labs	\N	\N
f6ba4a83-30d1-491d-b32a-4a1d4aa30297	Opal	\N	\N
9f173710-3f0e-447c-9831-2a360deaf937	Resolve AI	\N	\N
632c6682-8243-414b-ad6e-1ac839419ade	Espresso Systems	\N	\N
bbf0c73c-d70d-43a4-8a50-bda3b0f9e51f	Tank Payments	\N	\N
96965c09-f960-4308-9096-6eac7e5389b3	0x	\N	\N
4931dc7a-dc79-4f71-bef1-db304dda1bc0	Bedrock	\N	\N
\.


--
-- Data for Name: entity_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.entity_types (id, type_name) FROM stdin;
533819d7-212a-4527-afff-ff0c59c545b7	Multi-Stage VC
6cbdc8d1-8dc8-45f6-9fcf-a8b70409920e	Early-Stage VC
942476a4-e381-4eed-a414-2a3fb54365ac	Late-Stage Crossover
f3bc2045-70b2-40a7-8469-dc462787b4be	Thematic VC
cd93d077-9953-4ef1-8b32-26831cdd4d4e	Syndicate / SPV
1a0f0b65-757f-4fc1-9940-decfa94f09d4	Public REIT
2e98edd2-fce0-48ef-a371-c4bdc4e7455e	Private Non-Listed REIT
5d5baf7c-8e0e-49b7-b8b5-68475d4150f7	Private Placement / CRE
95176362-ae8c-4b89-80db-ec32437ff296	Pension Fund / Allocator
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organizations (id, name, entity_type_id, aum, website) FROM stdin;
b1fc8adc-355a-4c30-96f7-e8e34c40470b	Greylock	533819d7-212a-4527-afff-ff0c59c545b7	7600000000	https://greylock.com/
\.


--
-- Data for Name: contacts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contacts (id, org_id, first_name, last_name, role, linkedin_url, other_sites, accreditation_verified, bio, email) FROM stdin;
dafd9713-5db9-45b8-b50d-8797c7584ad8	b1fc8adc-355a-4c30-96f7-e8e34c40470b	Mor	Chen	Partner	https://www.linkedin.com/in/mor-chen-46460873/	{"twitter": "https://x.com/1mor_chen"}	f	Mor partners with Israeli entrepreneurs at the earliest stages of company formation in enterprise software and cybersecurity. Mor's journey into cybersecurity and technology began during her service in the elite Unit 8200 of the Israel Defense Forces (Israel's equivalent of the NSA) where she worked alongside some of Israel's most brilliant minds on cutting-edge technologies. 8200 is home to many incredible entrepreneurs like Assaf Rappaport, the founder of Wiz, Nir Zuk, the founder of Palo Alto Networks, and Shlomo Kramer, the founder of CATO Networks, and many others, inspiring Mor’s passion for innovation and leadership in the tech ecosystem. Mor brings a global perspective to investing at Greylock, shaped by a diverse career in Israel, London, and the US. She worked in Israel as a software engineer at VMware and strategy consulting at Strategy&, contributing to high-impact projects like the Mellanox-Nvidia acquisition. Most recently, she spent the past 4 years in London, as Vice President at Accel, focusing on early-stage investments in Israel. These experiences have equipped her with the network, and expertise to support early-stage founders as they navigate the complexities of building transformative companies. Mor began her career in the startup ecosystem as the Managing Director of the 8200 Alumni Association’s startup accelerator. In this role, Mor supported entrepreneurs at pre-seed stage, managed the alumni association fundraising, and led the board of a dozen global executives. She still serves on the board of the 8200 Alumni Association. Mor is eager to partner with entrepreneurs with relentless drive, who would break through walls to succeed. She loves to collaborate with founders who have the resilience to weather the tough times and keep striving for greatness. She will work days and nights to earn the right to work with those founders - in the trenches with them and dedicated to their success. Mor earned her B.S. in computer science and statistics from Tel Aviv University. Outside of her professional life, Mor enjoys practicing yoga and playing strategic-thinking games such as Settlers of Catan and Bridge.	mchen@greylock.com
eba68db1-f085-462e-9c7b-e67549b88e3b	b1fc8adc-355a-4c30-96f7-e8e34c40470b	Reid	Hoffman	Investor	https://www.linkedin.com/in/reidhoffman/	{"twitter": "https://twitter.com/reidhoffman"}	f	Reid builds networks to grow iconic global businesses, as an entrepreneur and as an investor. Reid is a Silicon Valley stalwart in the modern technology world. An accomplished entrepreneur and executive, he played an integral role in building many of today’s leading consumer technology businesses, including LinkedIn and PayPal. As an investor, he has been instrumental in the success of iconic companies such as Facebook and Airbnb and has helped fast-growing startups like Aurora and Convoy get to scale. Reid joined Greylock in 2009 and focuses on early-stage investing in products that can reach hundreds of millions of participants. His unique understanding of consumer behavior and a clear-eyed ability to guide startups from inception through ramped-up “blitzscaling” has made him one of the most sought-after advisors, partners, and investors today. Reid was a board observer for Airbnb and currently serves as a board director for Aurora, Blockstream, Coda, Convoy, Entrepreneur First, Joby Aviation, Microsoft, Nauto, and a few early-stage companies still in stealth. Reid’s core focus is on businesses with network effects. In 2003, he co-founded LinkedIn, the world’s largest professional network that today has more than 700 million members and a diversified revenue model that includes subscriptions, advertising, and software licensing. Before LinkedIn, Reid served as executive vice president at PayPal, where he was a founding board member and responsible for all of the company’s external relationships. His foundational thesis of the power of networks extends beyond marketplaces and social ecosystems. Recently, it has led to his investments in sectors including autonomous transportation, cryptocurrency, and shipping logistics. Reid is a frequent public speaker, known for his approachability and skill at explaining complex topics with lucidity. He is the co-author of Blitzscaling and two New York Times best-selling books: The Start-up of You and The Alliance and Masters of Scale. He also hosts the podcast Masters of Scale. A California native, Reid spent most of his life in the Bay Area. He earned a B.S. with distinction in symbolic systems from Stanford University and then earned a master’s degree in philosophy from Oxford University. He has honorary doctorate degrees from Babson University and the University of Oulu. Beyond startups and technology, Reid has a wide range of interests, including politics, board games, science fiction, philosophy, and philanthropy. He serves on several not-for-profit boards, including Kiva, Endeavor, CZI Biohub, the Berggruen Institute, New America, the Stanford Institute for Human-Centered AI, and the MacArthur Foundation’s Lever for Change. Reid has received various awards for his philanthropic work, including an honorary CBE from the Queen of England and the Salute to Greatness Award from the Martin Luther King Center.	\N
994518a0-a21c-4d37-85bc-07702c57cdf1	b1fc8adc-355a-4c30-96f7-e8e34c40470b	David	Thacker	\N	\N	\N	f	\N	\N
07cd867d-7628-4fae-b238-f4ff7b56381b	b1fc8adc-355a-4c30-96f7-e8e34c40470b	Corinne	Riley	Investor	https://www.linkedin.com/in/corinne-marie-riley/	{"twitter": "https://twitter.com/CorinneMRiley"}	f	Corinne works with entrepreneurs at the earliest stages of company development in enterprise software. Corinne brings global perspective to her role at Greylock. She got involved in startups through Dolead, a leads-generation solution based in France, where she worked on the sales and marketing team. Subsequently, she worked at CapitalSource in the Lending Finance group focusing on fintech startups in Mexico. Her passion for technology stems, in part, from the relatively analog way of life she experienced growing up in the small town of Viareggio, Italy. She said it wasn’t until she left to study at Wales – and later the University of Chicago – that she fully recognized the impact technology could have on everyday life. She was further galvanized to work in the field while working for Nobel Peace Laureate Professor Mohammad Yunus’s Grameen Bank, where she researched fintech and the mobile penetration movement in Dhaka, Bangladesh. Corinne is eager to partner with early-stage founders creating technology that fast-forward people and business into a digital-first world. Having worked with large companies well into their journey, Corinne is excited to work with those in the building stages. She is adept at identifying key metrics to guide strategy and develop sales motion, and is particularly excited to partner with founders as they recruit their first few crucial hires. Corinne joined Greylock following several years in investment banking in the technology practice at Morgan Stanley, working on the IPOs for companies like Uber, Zoom, and Palantir. Corinne lived most of her life in Italy before attending UWC Atlantic College in Wales. She then went to the University of Chicago, where she studied economics and history and was a Shriver Fellow at the Institute of Politics. Outside of work, she is passionate about environmental justice, traveling (pre-COVID), playing tennis, and making accidentally lopsided pottery in San Francisco.	corinne@greylock.com
03317251-dc6c-4630-ba4a-992d96e10f41	b1fc8adc-355a-4c30-96f7-e8e34c40470b	Asheem	Chandna	Partner	https://www.linkedin.com/in/chandna	{"twitter": "https://twitter.com/chandna"}	f	Asheem is attracted to founders who can communicate precisely about a problem and apply rigorous thinking to create an original solution. Asheem joined Greylock in 2003. He has been an investor and board director with over 20 technology companies, including three public companies and numerous that have been acquired in strong M&A outcomes. He has been a founding investor in multiple companies, including Palo Alto Networks (NYSE: PANW), AppDynamics (acquired by Cisco for $3.85B), Sumo Logic (Nasdaq: SUMO) and others. Asheem currently serves on the company boards of Abnormal, Censys, Dazz, Delphix, Obsidian, and Rubrik and a few companies in stealth. Asheem’s career is marked by interest and growing expertise in enterprise markets, products and company building. He has helped create and grow multiple businesses to market-leading positions – both as a venture capitalist (2003 – present), and previously at high-growth companies (1988 – 2002). Before arriving at Greylock, Asheem held product management, marketing, and business development leadership positions at Check Point Software and CoroNet Systems (acquired by Compuware). During his Check Point tenure, the company grew from $10M to $500M+ in annual revenues. Asheem began his career in product and marketing roles at AT&T Bell Laboratories and SynOptics/Bay Networks. Asheem’s prior company investments and/or company boards include Aquantia (MRVL), Arista Networks (ANET), Aruba Networks (HPE), Avi Networks (VMW), CipherTrust (McAfee), Imperva (Thoma Bravo), Neeva (Snowflake), NetBoost (INTC), PortAuthority Technologies (Forcepoint), Securent (CSCO), Sourcefire (CSCO), Skyhigh Networks (McAfee), Sumo Logic, TechProcess (Ingenico), Xsigo Systems (ORCL), and Zenprise (CTXS). He has been included in the Forbes Midas List since 2012, and the New York Times / CB Insights top venture capitalists list since inception in 2016. Born and raised in India, Asheem holds B.S. and M.S. degrees in electrical and computer engineering from Case Western Reserve University.	achandna@greylock.com
fc47aa40-29a4-4553-b28d-be66401b3c37	b1fc8adc-355a-4c30-96f7-e8e34c40470b	Josh	McFarland	\N	\N	\N	f	\N	\N
4e77a266-3cc0-482a-8732-53a355ec00ae	b1fc8adc-355a-4c30-96f7-e8e34c40470b	Christine	Kim	\N	\N	\N	f	\N	\N
02b9c3bf-1aff-4609-a16c-73e742d7441f	b1fc8adc-355a-4c30-96f7-e8e34c40470b	David	Sze	\N	\N	\N	f	\N	\N
a683fa2d-53ed-4fcf-a905-68132985c39f	b1fc8adc-355a-4c30-96f7-e8e34c40470b	John	Lilly	\N	\N	\N	f	\N	\N
e539aad8-3ee3-41e4-90cd-aa4f6f901870	b1fc8adc-355a-4c30-96f7-e8e34c40470b	Aneel	Bhusri	\N	\N	\N	f	\N	\N
d3ee1dde-9b9b-4815-8742-fffe75cf1b3c	b1fc8adc-355a-4c30-96f7-e8e34c40470b	David	Wadhwani	\N	\N	\N	f	\N	\N
91e0a37d-b2c0-4228-b205-dda4f103ac61	b1fc8adc-355a-4c30-96f7-e8e34c40470b	Josh	Elman	\N	\N	\N	f	\N	\N
03f38870-8648-4936-b772-1b71d5282711	b1fc8adc-355a-4c30-96f7-e8e34c40470b	Joseph	Ansanelli	\N	\N	\N	f	\N	\N
e7e06208-5b42-440a-9b4b-e36ae83765cb	b1fc8adc-355a-4c30-96f7-e8e34c40470b	James	Slavet	\N	\N	\N	f	\N	\N
93f38e2a-d8fe-47ab-85e3-767e9392ab28	b1fc8adc-355a-4c30-96f7-e8e34c40470b	Sridhar	Ramaswamy	\N	\N	\N	f	\N	\N
c27281aa-5878-4eaa-8823-375e8f3f28a6	b1fc8adc-355a-4c30-96f7-e8e34c40470b	Jacob	Andreou	\N	\N	\N	f	\N	\N
cc86acc3-4c2d-4487-975e-aa9c85f71deb	b1fc8adc-355a-4c30-96f7-e8e34c40470b	Sarah	Guo	\N	\N	\N	f	\N	\N
af833749-fcdd-46af-b503-6cd8366a4fc7	b1fc8adc-355a-4c30-96f7-e8e34c40470b	Jason	Risch	Investor	https://www.linkedin.com/in/jasoncrisch/	{"twitter": "https://x.com/rischter_scale"}	f	Jason works with entrepreneurs who are driving AI-enabled advances in software, infrastructure, and security. He joined Greylock in 2019, bringing with him a lifelong immersion in data and machine learning. Coming of age in the “Moneyball” era of baseball bred Jason’s fascination with statistics. While his dream job of becoming the general manager for the San Francisco Giants hasn’t panned out (yet), his love of using data to understand anomalies endured. Jason invests in technologies that matter and will shape the global landscape over the coming decades, like cybersecurity, machine learning, and creating robust and scalable cloud infrastructure. Security presents a critical battleground as enterprises work to secure environments from nation state and other bad actors armed with increasingly sophisticated AI-powered offensive cyber. Jason is excited about companies leveraging ML and automation defensively to combat the security talent shortage, as well as the evolving role of the security professional as security and engineering fields come together. ML is likewise transformational, as the next generation of enterprise and consumer companies will be designed around ML at their core. Jason works with founders building the infrastructure enabling companies to adopt LLMs across internal functions and integrate ML into their product lines. Jason and Jerry Chen collaborated on Greylock’s Castles in the Cloud series, a project mapping companies against cloud services and investigating how to build enduring cloud businesses independent of the hyperscalers. Prior to Greylock, Jason worked at the AI Fund startup studio with Stanford Professor Andrew Ng, where he launched AI-enabled vertical SaaS startups, including those recognized by CBInsights AI100 and the World Economic Forum’s Technology Pioneers list. Previously, he was a management consultant at McKinsey’s tech practice in the Bay Area. Jason first got involved with startups as a part of the business operations team during a high-growth period at Opendoor, where he optimized pricing models and purchasing processes to improve unit economics. There, while spending half of his time with the data science team and the other half in the field with real estate brokers, he got a taste for cross-functional collaboration, company-building, and scaling culture. Jason graduated Phi Beta Kappa from Stanford with a B.S. in Mathematical and Computational Science and an M.S. in Statistics with a focus on machine learning. While at Stanford, he received the J.E. Wallace Sterling Award for Scholastic Achievement and was also a Mayfield Fellow. He is an avid reader of sci-fi, fantasy, history, and geopolitics, and spends much of his free time hiking in his home county of Marin when not rooting for the Stanford Cardinal, Warriors, or Giants.	jrisch@greylock.com
bcdbb1cc-0d20-4ec8-906a-4a0ffc6ad834	b1fc8adc-355a-4c30-96f7-e8e34c40470b	Mike	Duboe	Investor	https://www.linkedin.com/in/mikeduboe/	{"twitter": "https://twitter.com/mduboe"}	f	Mike partners with founders building the next generation of commerce and marketplaces, and vertical applications, with a focus on driving sustainable growth. Mike brings a specialized mindset to the broadest of goals: growth. He focuses on helping founders identify, maneuver, and systematize their growth levers. Mike sits on the board of Builder, Inventa, Novi, Pepper, Postscript, and also led Greylock’s investments in Highstock, Lithos, Magic Eden, Paramark, Pinata, SuperMe, Tenor, Vori, and several unannounced companies. As an investor across commerce, marketplaces, and vertical software, Mike leverages his past experience as an operator to help founders assess where technology can be applied creatively to scale growth, product and marketing. Having overseen both nine-figure marketing budgets (across both digital and offline channels) and scrappy product-oriented growth teams, Mike understands what both healthy and unhealthy growth look like — and works with founders to help them leverage technology and product to drive growth. Prior to Greylock, Mike was the first in-house growth hire at Stitch Fix, where he built and led the Growth organization and developed a set of core operating principles that helped take the company through IPO. At Stitch Fix, Mike’s team leveraged the company’s strong foundation in personalization to establish a new discipline around driving measurable, sustained growth. Before that, Mike was the first growth hire at Tilt, where he built and oversaw multiple teams, including analytics, marketing, community, and growth product. He also served on YC’s growth advisory council, is a growth lecturer at Reforge, and was a growth advisor across various VC firms and startups. Mike’s success in evolving the user acquisition and growth capabilities of early-stage, product-focused companies comes from his obsession with data and a belief in the power of experimentation. He rejects the notion that growth can be hacked, and instead emphasizes the importance of building the right team, growth model, operating principles, and experiment frameworks. Mike says the bulk of his career decisions go back to his tendency to optimize for learning. He thinks the best founders are relentlessly, even obsessively curious, yet also find some counterbalance to (or within) this hyper-committed entrepreneurial life. “It’s no coincidence that many of the best founders combine their intensity with a great sense of humor!” Mike credits a large part of his (forced) balance to two kids, who help provide perspective and prioritize what’s absolutely necessary on a daily basis. Earlier in his career, Mike was a consultant with Bain & Company and worked in the Private Equity practice. Mike holds a BS & MS in Industrial & Operations Engineering from the University of Michigan, and an MBA from Stanford University.	mduboe@greylock.com
649cb3d0-52bf-41a6-b538-dde62697059b	b1fc8adc-355a-4c30-96f7-e8e34c40470b	Neiman	Mathew	Partner	https://www.linkedin.com/in/neiman-mathew-9a4320109/	{"twitter": "https://x.com/neimanmathew"}	f	\N	nmathew@greylock.com
40cc9064-9f75-4b0e-942c-5950c8265546	b1fc8adc-355a-4c30-96f7-e8e34c40470b	Sophia	Luo	Investor	https://www.linkedin.com/in/syluo/	{"twitter": "https://x.com/sophia_luo_"}	f	Sophia Luo is a seasoned startup operator and investor with a background in both engineering and product management. Growing up in the Bay Area, she attended MIT, where she earned her Bachelors of Computer Science, Bachelors of Mathematical Economics and, Masters of Engineering — all in four years. Sophia began her career in engineering at Scale AI when there were under 50 engineers. She transitioned into product management, spearheading the development and launch of several new products, including the Generative AI Data Engine. While at Scale AI, she also built the university recruiting program from the ground up and played a crucial role in building the engineering team and culture. She then went to Character AI as the 5th product engineer. There, she worked on both the core product and growth teams where she was responsible for driving top line engagement and new user metrics. Alongside her career, she actively invests in early-stage companies, including Cognition AI.	sluo@greylock.com
08633cde-d053-4140-be72-12c133ebb55b	b1fc8adc-355a-4c30-96f7-e8e34c40470b	Seth	Rosenberg	Investor	https://www.linkedin.com/in/sethgrosenberg/	{"twitter": "https://twitter.com/SethGRosenberg"}	f	Seth is interested in the generational opportunity for AI to change how people and businesses interact with money. Seth joined Greylock in 2017, following a career as a product manager at Facebook, where he led the launch of Messenger as a standalone app. While controversial at the time, Messenger grew to be one of the few apps globally used by over 1 billion people every month. Growing up in Winnipeg – a “Midwestern” Canadian town with few large corporations – entrepreneurship (albeit, in more traditional industries) drove outlier success, which drove Seth’s motivation to help create and scale companies – as both a product leader and investor. Seth started his career at Goldman Sachs in New York, where he worked in Technology and Media investment banking and helped take companies such as RetailMeNot and Intelsat public. After evenings learning to code by night while investment banking by day, he joined Facebook as one of the first Product Managers for Messenger. Since joining Greylock, Seth has led investments across fintech, AI SaaS, and consumer including Ramp, Bretton AI, Aspora, Roblox, Espresso, Lightfield, PayJoy, Pine, Wisetack and 0x. He previously worked with Roblox. As AI reshapes every industry, Seth is particularly excited about agentic workflows that automate work, and opportunities to build the next generation of consumer applications and networks. Seth is also passionate about mental health and financial inclusion.	srosenberg@greylock.com
c1ef9343-69d5-4569-9d90-aeff25836add	b1fc8adc-355a-4c30-96f7-e8e34c40470b	Shreya	Shekhar	Partner	https://www.linkedin.com/in/shreya-shekhar/	{"twitter": "https://x.com/_shreya_s"}	f	Shreya partners with early-stage founders building in AI, cybersecurity, infrastructure and developer tooling.	shreya@greylock.com
046ad0be-3aaa-4112-a53d-8c376d15c3e5	b1fc8adc-355a-4c30-96f7-e8e34c40470b	Jerry	Chen	Partner	https://www.linkedin.com/in/jerrychenprofile/	{"twitter": "https://twitter.com/jerrychen"}	f	Jerry focuses on category-defining companies building new products in enterprise software that transform markets or create entirely new ones. Jerry is an experienced technologist and company-builder who has helped create some of the defining infrastructure of transformative, enduring businesses. He works with entrepreneurs building companies in cloud infrastructure, data products and enterprise SaaS. People and ideas are at the core of Jerry’s investment thesis. He seeks out ambitious founders who focus on developing new technologies, business models, and solutions for AI, SaaS, data, and cloud infrastructure. Jerry joined Greylock in 2013, and backs founders with a strong product and operational sense across a range of sectors including AI, data, business applications, cloud infrastructure, and open source technologies. He is a board director for Blend (NYSE: BLND), Cato Networks, Chronosphere, Gladly, LlamaIndex, Mandolin, and Onehouse, and led investments in Docker, Instabase, Notable Health, and a few unannounced companies. His ability to work with a variety of teams across different company stages made him instrumental as an operator and now investor. He spent a decade at a cloud computing and virtualization company, VMware, where he was Vice President of Cloud and Application Services. As part of the team that created Cloud Foundry, Jerry ran the product management and marketing teams responsible for all of VMware’s application infrastructure products including vFabric, Spring, GemFire, and its big data projects. Prior to building VMware’s Cloud Application Platform, Jerry created and coined the term “VDI” for virtual desktop infrastructure as part of the inception of VMware’s enterprise desktop and application virtualization businesses. During his tenure, the company went from 250 to over 15,000 employees and $5B in revenue. Jerry’s background makes him the ideal partner for founders from company inception to late-stage scaling. He is particularly adept at advising on finding product market fit and go-to-market strategies. Prior to VMware, Jerry was an associate at Accel Partners. He also worked as an associate at AEA Investors and Bain and Company. He received a Bachelor of Science in Industrial Engineering from Stanford University and an MBA from the Harvard Business School where he was a George F. Baker Scholar. Outside of work, Jerry is a road cyclist and an aspirational chef whose interests run the gamut from exploring and improving San Francisco, to live music and collecting whiskeys (especially bourbon).	jerry.chen@greylock.com
84a37ed9-f656-4612-b0ec-0150da17a02e	b1fc8adc-355a-4c30-96f7-e8e34c40470b	Saam	Motamedi	Investor	https://www.linkedin.com/in/saammotamedi	{"twitter": "https://twitter.com/saammotamedi"}	f	Saam aspires to be the first partner for founders focused on building category-defining enterprise software companies. He partners with AI-native entrepreneurs, leveraging his experience helping companies develop from idea to public company revenue scale. At Greylock, he has led investments in and serves on the boards of application companies like Cresta, Fermat Commerce and Resolve AI; infrastructure companies like Braintrust, Orb and Snorkel; and cybersecurity companies such as Abnormal AI, Apiiro, Cogent Security, Fable Security, Opal, and Upwind Security. Saam brings a hands-on perspective to the ideas, markets, and people capable of reshaping the enterprise software stack. Before joining Greylock, he founded Guru Labs, a machine learning–driven fintech startup, and worked in product management at RelateIQ—one of the first AI application companies —where he led development of data products before and through its acquisition by Salesforce. With a background spanning entrepreneurship, product leadership, and early-stage investing, Saam is a natural partner to founders navigating the critical early steps of company-building, from recruiting foundational teams to securing early customers. He is equally driven by advancing nascent concepts into viable companies and understanding the inner workings and priorities of large enterprise companies. Saam grew up in Houston, Texas, and holds a B.S. in Computer Science from Stanford University, where he was a Mayfield Fellow. Outside of work, he is an avid tennis player and devoted fan of Stanford and Houston sports teams.	smotamedi@greylock.com
\.


--
-- Data for Name: contact_investments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contact_investments (id, contact_id, company_id, relationship, exit_note) FROM stdin;
5cf7424b-77cc-4663-ac4c-179644388c02	03317251-dc6c-4630-ba4a-992d96e10f41	cb844f0e-b0b1-4cb8-b1a3-33826e9ab29d	current	\N
3cdeb83d-a380-4cb6-88c6-f9ebcade9cfa	03317251-dc6c-4630-ba4a-992d96e10f41	09a5da71-6d1a-4e2a-8a5b-e423352cc54e	current	\N
7facbda2-1d7a-4dba-8a6d-21dde323dee5	03317251-dc6c-4630-ba4a-992d96e10f41	73237cdb-24e4-4bc1-98c8-231d47b01e56	current	\N
a51df2c1-c522-4c24-b249-3a27f4f9ee8d	03317251-dc6c-4630-ba4a-992d96e10f41	9fe2047c-e1a1-4e88-9085-102f52015563	current	\N
1c221014-6544-4dfc-b40e-35f537c504ef	03317251-dc6c-4630-ba4a-992d96e10f41	559597bc-8061-4b01-a0d7-77b3ffc055bf	current	\N
51e31581-856c-4949-ad26-4057b737f5e8	03317251-dc6c-4630-ba4a-992d96e10f41	72f1a0aa-b557-4f96-8be7-ffda7e0d97f1	current	\N
ed8acfe1-a7a8-420e-b964-ee4b620a017b	03317251-dc6c-4630-ba4a-992d96e10f41	e3cb9ab4-7993-41a6-bcc0-dd5538275e44	current	\N
ced3505c-a0ab-4666-9672-4b44c79bec71	03317251-dc6c-4630-ba4a-992d96e10f41	d0c2b4f8-6c00-4f1e-8083-7448dbe24f7e	previous	Acquired by Cisco in 2017
095612f8-7db3-4640-9df8-937950dde670	03317251-dc6c-4630-ba4a-992d96e10f41	44b0eda3-73ea-412c-a06a-e777781d71b0	previous	Acquired by VMware in 2019
eaa0179e-3d30-4b4c-ab21-1fb38381ee0d	03317251-dc6c-4630-ba4a-992d96e10f41	1b27594e-123d-4517-acdf-ecdfa98a3b53	previous	acquired by Arista
cd6a5a47-4182-4b14-80ac-3fd82e4067aa	03317251-dc6c-4630-ba4a-992d96e10f41	b942e2b4-1a17-4fec-a8ef-388ee3a02d5e	previous	acquired by Marvell
352d5b06-c959-4c4e-b659-02e7ea0ce9d5	03317251-dc6c-4630-ba4a-992d96e10f41	fd3cb59b-2712-401b-93f6-786a66715d52	previous	Acquired by Thoma Bravo in 2018
6682bb63-f543-402c-8d75-3de43b019c5a	03317251-dc6c-4630-ba4a-992d96e10f41	58ae88a8-7e8c-424a-a050-dcbcd1da8590	previous	Acquired by Snowflake
db9f5c39-0cf0-4eed-89ae-912dbc173ca9	03317251-dc6c-4630-ba4a-992d96e10f41	cd8bb90c-18e9-450a-b5cd-c68241e42d2c	previous	Acquired by McAfee in 2017
adef3504-92ed-4eca-9404-7b7012e3b26a	03317251-dc6c-4630-ba4a-992d96e10f41	2d022f26-4a79-4c7e-b03a-596ffac71577	previous	IPO 2017
b8f5f78d-3249-412d-996b-c90ee43f7757	03317251-dc6c-4630-ba4a-992d96e10f41	4ad5b397-d2db-4484-b36a-7bd02f296a80	previous	Acquired by Ingenico in 2017
344b25ed-4ec0-45ad-b514-cbc5fbd73a38	03317251-dc6c-4630-ba4a-992d96e10f41	d3151bf5-82f2-4977-980e-172bea201bfc	previous	IPO 2014
fc974a25-520f-4d58-9375-8493b44f5541	03317251-dc6c-4630-ba4a-992d96e10f41	8c0aad18-f3d2-46f0-8170-9268beb74128	previous	Acquired by Citrix in 2013
f5645fad-05c5-4d46-92ac-cc2abaed062b	03317251-dc6c-4630-ba4a-992d96e10f41	ff3ef1c6-50b0-4691-a70c-927ffa4dc5e6	previous	Acquired by Cisco in 2013
38419489-19a3-48f7-86b2-65e4585c8d7b	03317251-dc6c-4630-ba4a-992d96e10f41	befbfb86-355f-489b-bc93-5d5174fee706	previous	Acquired by Oracle in 2012
fec742d6-1e6b-4350-988e-43a91405dbbb	03317251-dc6c-4630-ba4a-992d96e10f41	1c6c67ed-77e8-4c8b-94f7-c820ba9c94b4	previous	IPO 2007
83e16096-52ea-42a3-8abc-dbfb766c09a0	03317251-dc6c-4630-ba4a-992d96e10f41	4dbaf686-b525-426d-9b56-0dd67b7d2a06	previous	Acquired by Websense in 2007
af40e876-c9c4-4d13-80fd-f7ea05cc591d	03317251-dc6c-4630-ba4a-992d96e10f41	4b608283-f22e-4158-b3e3-770e41191fb0	previous	Acquired by Cisco in 2007
1abd6d70-4b42-4b61-9329-d619dfcf65a0	03317251-dc6c-4630-ba4a-992d96e10f41	5ae509c7-e688-4396-9675-4f7d6b714891	previous	Acquired by Secure Computing in 2006
c8b097d5-6af9-4da0-9f13-51806831850b	03317251-dc6c-4630-ba4a-992d96e10f41	7f527b5b-5026-4c71-abfd-b30fc224ff4d	previous	Acquired by Intel in 1999
1cafde56-238e-4baa-b595-0884a72d3313	046ad0be-3aaa-4112-a53d-8c376d15c3e5	0e58ae00-a3fd-44f8-bd10-587d3e39c707	current	\N
50717886-ef9f-45e2-b3ae-24866a3d104b	046ad0be-3aaa-4112-a53d-8c376d15c3e5	0fc99808-b43f-450e-af9c-c94b9c9c31d3	current	\N
2904d31c-f6b6-439f-8c43-ed414e62bc61	046ad0be-3aaa-4112-a53d-8c376d15c3e5	6a587305-e673-44b1-964f-3a23adcd7c8c	current	\N
770f3b9b-a7e6-48ad-a939-2a9034c6d046	046ad0be-3aaa-4112-a53d-8c376d15c3e5	9c215f93-55d3-484c-acff-2576d1b5c058	current	\N
e3a7c54d-7261-48ab-a97e-b4686592cd27	046ad0be-3aaa-4112-a53d-8c376d15c3e5	67b4f98c-acd2-477b-80ed-254c461fbb99	current	\N
b3b8d1ca-201b-4c01-84d3-c64c4ed24729	046ad0be-3aaa-4112-a53d-8c376d15c3e5	d3482119-1b21-4c9b-b932-bee08554e2bd	current	\N
66c54112-eabf-4130-ba20-87a324fa91b6	046ad0be-3aaa-4112-a53d-8c376d15c3e5	bea5071d-50c3-48d8-a117-435da008bcb7	current	\N
05050782-907e-404c-b5db-0521ac393f66	046ad0be-3aaa-4112-a53d-8c376d15c3e5	da7cc546-3a02-40e4-9489-ac1ea9ccd568	current	\N
792581c8-dd29-4d32-97e7-4b1c3555d2b5	046ad0be-3aaa-4112-a53d-8c376d15c3e5	e49ff184-4f7f-452e-9aca-6e665ee83e81	current	\N
515b8008-fa4c-418e-a868-409db13e9f1f	046ad0be-3aaa-4112-a53d-8c376d15c3e5	555b6456-a949-45b8-9b6c-0183767fb0ea	previous	Acquired by Okta
3740238b-abe0-4c97-a5aa-c0b2747bd246	046ad0be-3aaa-4112-a53d-8c376d15c3e5	e25ad2cb-986f-4cb3-b889-09576fba016d	previous	Acquired by Salesforce
fcc69117-79fb-4d6c-99fa-0f7323d71a9c	046ad0be-3aaa-4112-a53d-8c376d15c3e5	e83319eb-69c8-4d06-ba4f-48d050a576d2	previous	NYSE: BLND
9c82cbe5-de74-4e88-95a1-97e089dd1ee3	046ad0be-3aaa-4112-a53d-8c376d15c3e5	549bdc67-9e62-4a0f-a668-0c0e4d77649a	previous	Acquired by OpenAI
f3bef568-b900-45ef-a6fa-0974923b7092	046ad0be-3aaa-4112-a53d-8c376d15c3e5	cd04d884-3b1e-4909-bebe-2dfca6abeb5e	previous	Acquired by Snowflake
e3045dbd-1806-4bdb-a5ec-d679e31aa2f9	046ad0be-3aaa-4112-a53d-8c376d15c3e5	bba901ce-3969-463f-b730-df718a9b1044	previous	Acquired by Confluent
41b26101-1dad-49db-b3eb-750e23845f63	bcdbb1cc-0d20-4ec8-906a-4a0ffc6ad834	0379335a-58ef-4280-8f29-7f40ab0c0b96	current	\N
4bb5e0c0-5860-4474-9986-3dcf36bf7356	bcdbb1cc-0d20-4ec8-906a-4a0ffc6ad834	7a69bae5-2fde-4841-b3f3-88dfbe8f8739	current	\N
af01c306-e3e0-4e90-ba80-ff1f9d54d6fe	bcdbb1cc-0d20-4ec8-906a-4a0ffc6ad834	523157f5-4b51-4d1b-a097-a1755eb5f167	current	\N
7555b5db-3d5f-40a9-94a4-7952c5cbc8b4	bcdbb1cc-0d20-4ec8-906a-4a0ffc6ad834	65802d4c-7e94-48c9-9d78-5e6dca66855c	current	\N
5d8bdd3e-8c5a-421c-946c-357691750c80	bcdbb1cc-0d20-4ec8-906a-4a0ffc6ad834	c5a3e85f-772d-4c57-86d5-200287ffbc19	current	\N
bee41f57-caa6-4a32-b456-884f702b7dc2	bcdbb1cc-0d20-4ec8-906a-4a0ffc6ad834	66d11e12-dd53-4bf8-a695-f07d72c87f02	current	\N
91c91bcc-5950-4556-b573-99d219338983	bcdbb1cc-0d20-4ec8-906a-4a0ffc6ad834	ab09cae8-b19d-4a48-adb0-7ba24d8b41d1	current	\N
ddfc4f55-00f9-4b3b-89b5-48f8abd18c91	bcdbb1cc-0d20-4ec8-906a-4a0ffc6ad834	70cee19a-cf2f-4d06-9208-a33c6833a62c	current	\N
3cb8ff05-fdbb-47d0-a4dc-9b51aaef9812	bcdbb1cc-0d20-4ec8-906a-4a0ffc6ad834	48390061-bb7c-4bee-a65a-5901c619d78f	current	\N
655b7b2d-24f9-475d-a66a-7f37a53a5d5a	bcdbb1cc-0d20-4ec8-906a-4a0ffc6ad834	32033c79-164b-4378-844d-361529bf7f43	current	\N
a3f0c0fc-cc56-4508-8b72-f62e7ebdbb27	bcdbb1cc-0d20-4ec8-906a-4a0ffc6ad834	360f1e35-dadd-4715-9572-d68b2b745fc3	current	\N
1b0c853d-46a8-425a-a981-1cecab7e8335	bcdbb1cc-0d20-4ec8-906a-4a0ffc6ad834	a30b52d5-d5cd-4076-afda-a8ad19d391eb	current	\N
b1eb46d7-f546-4a92-bb39-140da3ce948a	bcdbb1cc-0d20-4ec8-906a-4a0ffc6ad834	62bab1bc-06e2-4c6b-9632-98bc3c133ee7	current	\N
a2dc7a3c-5c30-4704-830c-629e7ebb54ce	bcdbb1cc-0d20-4ec8-906a-4a0ffc6ad834	d76b5464-8b23-41d5-aa06-48292db60024	current	\N
8a5466d4-02bb-4a38-8886-a8ac4cb05bf0	bcdbb1cc-0d20-4ec8-906a-4a0ffc6ad834	3f0f0773-dc6f-40df-89a4-aa5051f1127b	current	\N
007b9642-e87a-4b32-b2d0-0ac3e0b9d31d	bcdbb1cc-0d20-4ec8-906a-4a0ffc6ad834	989e9e98-f4ed-4c1c-be42-eec6c9433294	current	\N
a0d5f72c-fa55-4882-b1df-017157be9814	eba68db1-f085-462e-9c7b-e67549b88e3b	6a9ff221-ce88-44b1-bc0f-bedd2f0f0be4	current	\N
a259ccf2-099e-4c01-9fb1-34403ed46620	eba68db1-f085-462e-9c7b-e67549b88e3b	74f88cb8-6ba3-4016-a6ce-1c236a0f7f07	current	\N
b2f2281d-cf5a-42ea-b68e-1873b763199c	eba68db1-f085-462e-9c7b-e67549b88e3b	faeddf27-a4c1-4606-a66f-90947dbbada6	current	\N
155d2037-fbda-4a80-a446-14ec168cab6d	eba68db1-f085-462e-9c7b-e67549b88e3b	a4227b7f-6550-4995-b7a2-23f452475f02	current	\N
08446544-b84b-4b7b-9ba3-e9d577ba9cdd	eba68db1-f085-462e-9c7b-e67549b88e3b	47db18c5-c134-4c7d-b816-b210bdecf4d9	current	\N
455eae0a-10ef-4918-8fe4-5e9184465107	eba68db1-f085-462e-9c7b-e67549b88e3b	d95a4f4b-ae61-4788-afce-f097fbf7d8e6	current	\N
83cc0b34-be02-45d5-a908-a4c5f99a520a	eba68db1-f085-462e-9c7b-e67549b88e3b	dd35fe52-3a16-4023-a6bf-8e8f93ab1509	current	\N
3d7a7c10-0be9-443e-8619-3b6bb4525002	eba68db1-f085-462e-9c7b-e67549b88e3b	3c7eb52c-c17a-41fb-980f-408b7a2f4d17	current	\N
363625da-bcdf-41ab-9513-cca096003ace	eba68db1-f085-462e-9c7b-e67549b88e3b	564da3ef-756a-49e1-a71d-724c757e29e2	previous	IPO 2020
f81863b2-38f8-4d46-a217-f9e32b4d88b1	eba68db1-f085-462e-9c7b-e67549b88e3b	1c8008c7-0e85-4f6a-b8a5-c43bb5be947d	previous	IPO 2014
8acdbbd1-d693-4364-8485-bef00a55d227	eba68db1-f085-462e-9c7b-e67549b88e3b	58ae88a8-7e8c-424a-a050-dcbcd1da8590	previous	acquired by Snowflake
8d883742-4b01-4d37-ba8c-f37ca2cea36a	eba68db1-f085-462e-9c7b-e67549b88e3b	a0ac9209-b4ad-4c65-9af6-1723ee2b4bb7	previous	Acquired by NetDragon in 2017
c4f0f994-a7be-4c31-aca4-2a7ec291be43	eba68db1-f085-462e-9c7b-e67549b88e3b	20666127-e71e-4b23-8e30-322c73732547	previous	Acquired by SK Telecom in 2014
f8a8cad1-ebfd-4103-ae73-455ffcb53e13	eba68db1-f085-462e-9c7b-e67549b88e3b	e4ada4da-729e-4a5b-b14a-f0f37e5a1947	previous	Acquired by Visa in 2015
19a9a896-0f58-428c-8ed7-d7205cc95e01	eba68db1-f085-462e-9c7b-e67549b88e3b	173dd2e7-4b0a-4044-af02-f69b0a016c63	previous	Acquired by Rakuten in 2013
bdacd8af-82d5-42fc-af2d-6e210a08a338	84a37ed9-f656-4612-b0ec-0150da17a02e	cb844f0e-b0b1-4cb8-b1a3-33826e9ab29d	current	\N
c272ab9c-c927-4dd7-acf0-27d0ec71b13e	84a37ed9-f656-4612-b0ec-0150da17a02e	54b3dab3-5222-47e3-88f5-e4f4e06f08ad	current	\N
a276248c-728c-4ecf-a587-6df44c8ccd19	84a37ed9-f656-4612-b0ec-0150da17a02e	032f1d33-734f-4994-a3b7-44f5636c07a9	current	\N
8116c712-d237-4b70-9123-d60bcd8a84cf	84a37ed9-f656-4612-b0ec-0150da17a02e	3a0be0bf-afcd-4f3b-b1bf-a2cc65cab3d2	current	\N
b4bd57ec-1515-498b-9e5e-18aed13c8a6e	84a37ed9-f656-4612-b0ec-0150da17a02e	1b20237d-3d73-4e59-bc5f-db6bc5993ef5	current	\N
d040c645-b865-4d32-9752-9f1831f376ea	84a37ed9-f656-4612-b0ec-0150da17a02e	a2c4a9ed-3a8d-4102-87ed-d00c734cb033	current	\N
13398df9-7fff-4d5b-a201-cb3d9ce5fdeb	84a37ed9-f656-4612-b0ec-0150da17a02e	1053bc5a-4805-4c31-b017-e8311ae36efc	current	\N
5f51a1d7-25a1-4640-965b-2d9686f77dfc	84a37ed9-f656-4612-b0ec-0150da17a02e	eb476fc1-66ce-4031-8319-a2a8bb4ee67e	current	\N
cd275301-adae-4431-b3cc-5bbbf329f408	84a37ed9-f656-4612-b0ec-0150da17a02e	9e8eee0a-c88e-4085-9ec1-fc9f942f3f6a	current	\N
db3dd895-a47a-4dd6-8823-d5c065683b56	84a37ed9-f656-4612-b0ec-0150da17a02e	a94436ff-c313-4727-89da-2cf701b7af0a	current	\N
81f2ad89-2eed-4ceb-bd98-573d90781d9b	84a37ed9-f656-4612-b0ec-0150da17a02e	f6ba4a83-30d1-491d-b32a-4a1d4aa30297	current	\N
63c0b13a-0888-4de4-9e70-a212b09b6cbf	84a37ed9-f656-4612-b0ec-0150da17a02e	bfe690f1-2da1-40d1-afc7-55b347f58ae7	current	\N
ee6c600e-2fdd-427f-8356-18db7f3693d6	84a37ed9-f656-4612-b0ec-0150da17a02e	9f173710-3f0e-447c-9831-2a360deaf937	current	\N
2b691b9a-3fa1-4f33-9bca-7f16f577995b	84a37ed9-f656-4612-b0ec-0150da17a02e	09b8626e-b19b-4459-af2b-9972438cf58e	current	\N
61e2ba2d-7755-47db-b855-a3a983a02f81	84a37ed9-f656-4612-b0ec-0150da17a02e	4e8ba09c-4df6-43b6-ad04-5ffdab3190e1	current	\N
e2ebf02d-b181-4cbb-b300-75761d962e37	84a37ed9-f656-4612-b0ec-0150da17a02e	562b2b1f-2028-4a0c-846c-2532ab95a6f7	current	\N
6387be55-62dc-4bc3-b6c2-b23f4d33b4aa	84a37ed9-f656-4612-b0ec-0150da17a02e	bfe690f1-2da1-40d1-afc7-55b347f58ae7	previous	Acquired by Rubrik
b124a904-1417-4a9d-a016-5a0d7ccea91d	84a37ed9-f656-4612-b0ec-0150da17a02e	2f50c989-f908-4aff-b73d-ebac565a53c8	previous	\N
f31752fe-bef8-441c-9585-40427234184b	08633cde-d053-4140-be72-12c133ebb55b	70071536-b9fc-4a61-9de4-06bad75e3158	current	\N
eef9da92-0a0b-4d12-b38f-ea09f3eb83b1	08633cde-d053-4140-be72-12c133ebb55b	632c6682-8243-414b-ad6e-1ac839419ade	current	\N
31b5cd4f-0f03-4764-b458-88e2819c0e5c	08633cde-d053-4140-be72-12c133ebb55b	d10b1fe8-8103-42c6-9e2b-f05fc01d3cad	current	\N
436a2e38-925b-4bb0-842c-48092adc593d	08633cde-d053-4140-be72-12c133ebb55b	bae1e8b5-98a6-4ec0-8585-03bdf0aba42d	current	\N
b2f65bf8-7d1f-4b8d-94a0-7d7dbb7870c3	08633cde-d053-4140-be72-12c133ebb55b	dd8f56e7-a0c5-41c8-8d74-19b06d6704cf	current	\N
1479d328-2cd5-42e0-a2cf-fc43fd5fccdd	08633cde-d053-4140-be72-12c133ebb55b	e83d809e-5b6f-43e9-8d39-b2a74273a7b7	current	\N
22b93f45-9863-473f-ade2-62f545c5774c	08633cde-d053-4140-be72-12c133ebb55b	831332e7-942f-477a-afa2-2a1bd6261847	current	\N
0ba20d30-aa89-4b2b-8087-ea166c61bfd7	08633cde-d053-4140-be72-12c133ebb55b	bbf0c73c-d70d-43a4-8a50-bda3b0f9e51f	current	\N
fda4f9c8-8a9e-4e55-8594-f9e2a3058cea	08633cde-d053-4140-be72-12c133ebb55b	24b8298a-c57e-4d73-91e7-7eb3e92f988d	current	\N
035308a8-feb1-4e90-b755-72e845accb2c	08633cde-d053-4140-be72-12c133ebb55b	96965c09-f960-4308-9096-6eac7e5389b3	current	\N
1341f953-4660-4c0d-846c-5110c51af6d1	08633cde-d053-4140-be72-12c133ebb55b	a5c7a498-70e4-49ca-84ce-3d2e85ee91cc	previous	\N
86f065e4-cb9a-4196-8e72-ba485dfc549e	af833749-fcdd-46af-b503-6cd8366a4fc7	ff366e4e-1695-47dc-9bad-c0de2ec359a0	current	\N
29122080-a92c-455e-8c73-906ebc85b99c	af833749-fcdd-46af-b503-6cd8366a4fc7	70071536-b9fc-4a61-9de4-06bad75e3158	current	\N
920ee29c-8a4d-4aaf-aa7f-76b83b12bef6	af833749-fcdd-46af-b503-6cd8366a4fc7	4931dc7a-dc79-4f71-bef1-db304dda1bc0	current	\N
a7454f92-066e-4f70-b23c-1499bd3271d1	af833749-fcdd-46af-b503-6cd8366a4fc7	52119f24-f3ad-46e8-a1bf-87175d5d782e	current	\N
9bef3f1a-1f82-49e5-82ec-d68095e1f4b8	af833749-fcdd-46af-b503-6cd8366a4fc7	c1b9405b-2156-4b6e-9bd4-276aa8d49037	current	\N
73c96d72-fdcd-4237-b2a6-0ba78d39c340	af833749-fcdd-46af-b503-6cd8366a4fc7	f26b39b5-bf4a-4ca8-a08b-2eea4ea8ca61	current	\N
899f8e22-6c9f-47f3-bfd2-28eabb417c3d	af833749-fcdd-46af-b503-6cd8366a4fc7	166d5ab3-5a7e-4669-8339-ca90185d168a	current	\N
c16d8dab-bb81-473a-bf6e-267122ee223e	af833749-fcdd-46af-b503-6cd8366a4fc7	d3482119-1b21-4c9b-b932-bee08554e2bd	current	\N
046dd2be-0fcc-4fcd-b6e0-4fc3f98ce124	af833749-fcdd-46af-b503-6cd8366a4fc7	562b2b1f-2028-4a0c-846c-2532ab95a6f7	current	\N
40bd8149-a776-410e-b2a8-ecec81204304	af833749-fcdd-46af-b503-6cd8366a4fc7	bfe690f1-2da1-40d1-afc7-55b347f58ae7	previous	Acquired by Rubrik
\.


--
-- Data for Name: contact_verticals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contact_verticals (id, contact_id, vertical_id) FROM stdin;
\.


--
-- Data for Name: pipeline_stages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pipeline_stages (id, stage_name, sort_order) FROM stdin;
1cca0949-8624-4c79-9a45-0e25e60708df	Researching	1
a26c2559-73aa-47e6-b86c-fd3ba8ddd7a0	Contacted	2
cbbc5d83-be5a-4a7c-9551-934b80f213d3	Meeting Scheduled	3
366e4213-853e-4f00-827c-84b411db4d00	In Diligence	4
9cc2b9ed-f98c-4dc6-be99-fcc6faba1b6a	Committed	5
c7699fe8-a0fb-4f5c-983e-ca657d89f90d	Passed	6
\.


--
-- Data for Name: deals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deals (id, client_id, contact_id, pipeline_stage_id, created_at) FROM stdin;
\.


--
-- Data for Name: portfolio_investments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.portfolio_investments (id, org_id, company_id, investment_stage) FROM stdin;
20170b9c-95d3-4ebc-a0f1-648436d1be59	b1fc8adc-355a-4c30-96f7-e8e34c40470b	4da0b124-354a-4839-ad40-9474f14e09b4	Series B
5c1ebd50-4cef-4f7f-8264-e5b2eac7b744	b1fc8adc-355a-4c30-96f7-e8e34c40470b	ff366e4e-1695-47dc-9bad-c0de2ec359a0	Seed
9da111f0-ee17-4fc2-a19a-e349ec0d84c2	b1fc8adc-355a-4c30-96f7-e8e34c40470b	b925c276-8f2c-4f98-a91d-e0d288c1cee5	Seed
29731907-c1a7-4fda-90c8-2bdf16d51c63	b1fc8adc-355a-4c30-96f7-e8e34c40470b	d91d18ac-4581-4ab5-ac24-3a4bb849bba0	Seed
aae7e1fe-8259-4342-9dca-740f1889f1be	b1fc8adc-355a-4c30-96f7-e8e34c40470b	2f50c989-f908-4aff-b73d-ebac565a53c8	Seed
9cab4e29-c24b-4c45-a1cf-f729a3dc9c5d	b1fc8adc-355a-4c30-96f7-e8e34c40470b	4794d070-21b0-40d9-8a7f-789408fcbc66	\N
be94d44f-6944-4c26-b9af-852f3522dc24	b1fc8adc-355a-4c30-96f7-e8e34c40470b	564da3ef-756a-49e1-a71d-724c757e29e2	Series A
92e3c6cb-7723-457d-9786-7926d91bd909	b1fc8adc-355a-4c30-96f7-e8e34c40470b	3d8649a3-6e45-4580-a226-263e62e8f514	Series B
76d6af12-70b1-4d9b-9ac6-91d0a6774e8a	b1fc8adc-355a-4c30-96f7-e8e34c40470b	563578b7-ff05-4676-9ab0-acf0de00f1f4	Seed
88807932-94b3-4c74-9d94-217b72b0d545	b1fc8adc-355a-4c30-96f7-e8e34c40470b	6a5ce6d5-3563-47e6-99a9-da92a9d92fba	Seed
b05ad5cb-b92d-4b8f-b18d-404ba01caab1	b1fc8adc-355a-4c30-96f7-e8e34c40470b	904a60a5-f71f-4097-a873-f56ef847a141	Series F
8835e786-0b15-466f-ba12-cd7086237c48	b1fc8adc-355a-4c30-96f7-e8e34c40470b	54b3dab3-5222-47e3-88f5-e4f4e06f08ad	Seed
f8cbe120-0314-4525-9e06-717ecc61ef5d	b1fc8adc-355a-4c30-96f7-e8e34c40470b	d0c2b4f8-6c00-4f1e-8083-7448dbe24f7e	Seed
183388e8-3a5f-4910-bab6-859b6e966574	b1fc8adc-355a-4c30-96f7-e8e34c40470b	70071536-b9fc-4a61-9de4-06bad75e3158	Series A
fa041f97-2359-4f10-a486-fe2ec10725bc	b1fc8adc-355a-4c30-96f7-e8e34c40470b	cd2bfa7d-11f5-49c6-a5b1-741f9e1d3be4	Series A
b58aed8f-4974-429e-89ae-0d5e3ab92eda	b1fc8adc-355a-4c30-96f7-e8e34c40470b	46cbed95-bc3f-47f4-8f84-7370495dbd75	Seed
de0ebf59-97bf-426c-b272-85acafb19b36	b1fc8adc-355a-4c30-96f7-e8e34c40470b	5150dda5-f5d9-48c0-8733-cba01ef473c1	Common Stock
81affa87-f935-4b33-a59c-11476e7fd69f	b1fc8adc-355a-4c30-96f7-e8e34c40470b	6a9ff221-ce88-44b1-bc0f-bedd2f0f0be4	Series A
8dcdf6b5-49a9-42dd-a3da-c48f93d040ed	b1fc8adc-355a-4c30-96f7-e8e34c40470b	69beb20c-0f1e-4979-a346-4651c5633d36	Series A
00da3092-f2a6-4e96-a3f0-e34d6b3fe0b9	b1fc8adc-355a-4c30-96f7-e8e34c40470b	44b0eda3-73ea-412c-a06a-e777781d71b0	Series A
b7d567d5-d5dc-47b6-ad74-82057a3bba6b	b1fc8adc-355a-4c30-96f7-e8e34c40470b	2cbe1630-6f1e-43ee-b059-036590f2c360	Series A
8dc6293c-29c6-42b9-acb3-b3cba01c62d5	b1fc8adc-355a-4c30-96f7-e8e34c40470b	1b4483c6-8ef4-4788-8833-aa9cf0311577	Seed
21b3e151-fe86-4a24-a6d4-81f0236400f5	b1fc8adc-355a-4c30-96f7-e8e34c40470b	58651e51-5c1b-4a9f-84ab-ea41db356240	Seed
76bac743-f09d-4e59-b5ad-2748352be295	b1fc8adc-355a-4c30-96f7-e8e34c40470b	e83319eb-69c8-4d06-ba4f-48d050a576d2	Series D
743db776-2f10-4b13-96d6-38922ee646e9	b1fc8adc-355a-4c30-96f7-e8e34c40470b	52119f24-f3ad-46e8-a1bf-87175d5d782e	Seed
20ea4403-68ae-4376-b38b-a131ca5add1b	b1fc8adc-355a-4c30-96f7-e8e34c40470b	d10b1fe8-8103-42c6-9e2b-f05fc01d3cad	Seed
85b2e0ea-3d74-4c01-b545-dfbbe2727488	b1fc8adc-355a-4c30-96f7-e8e34c40470b	14042433-f203-4212-8714-321255177ba5	Series A
e00d42b2-671f-462a-9738-9c4d9dfae10d	b1fc8adc-355a-4c30-96f7-e8e34c40470b	0cb6494f-e83a-49d9-abe7-76007a63b196	Seed
98fe538c-2284-418c-b35f-2f140072b478	b1fc8adc-355a-4c30-96f7-e8e34c40470b	008502f8-c787-4e68-97b9-7ebb6e5d204d	Seed
3701f02b-8b5b-468b-bc29-286de67eb7ba	b1fc8adc-355a-4c30-96f7-e8e34c40470b	3e3ba3e6-5205-4bd9-bded-d9bfdc64c49a	Series A
9222c61e-d798-4c59-93fe-b0b4e81699bc	b1fc8adc-355a-4c30-96f7-e8e34c40470b	129e2114-2ea1-4473-9968-c28c54587065	Series B
982d43ca-3b88-4332-839b-b2ba86d89ab3	b1fc8adc-355a-4c30-96f7-e8e34c40470b	09a5da71-6d1a-4e2a-8a5b-e423352cc54e	Seed
f741da7b-c2ca-459a-98cd-72b84f9ffae1	b1fc8adc-355a-4c30-96f7-e8e34c40470b	2a068b4b-708c-49d0-b763-deefd3491555	Series A
40db1f37-a5fa-41fe-8727-6facc5749484	b1fc8adc-355a-4c30-96f7-e8e34c40470b	0fc99808-b43f-450e-af9c-c94b9c9c31d3	Series A
5140bcb3-0f5d-4afb-a221-8c5712ae596d	b1fc8adc-355a-4c30-96f7-e8e34c40470b	af7802d7-3632-4791-bf13-3ebf4a622d83	Series A
df271c6b-16a5-4913-983c-178ac9ab391f	b1fc8adc-355a-4c30-96f7-e8e34c40470b	4381695f-9542-4db8-834b-d7094a7f4be1	Series A
73db79d2-1847-4bf1-b27c-0c8a326c39d4	b1fc8adc-355a-4c30-96f7-e8e34c40470b	6ad57bda-91da-4d2b-bf85-fcbbf58a0099	Series B
db1c4e1b-0156-467c-8f99-f30afcf384c0	b1fc8adc-355a-4c30-96f7-e8e34c40470b	faeddf27-a4c1-4606-a66f-90947dbbada6	Series A
be3c5643-affe-4cae-b50f-fbe68bafe930	b1fc8adc-355a-4c30-96f7-e8e34c40470b	3212607d-e1bc-482b-bf18-5f445bbfe0a7	Seed
549d80a1-8c98-4680-9fd0-fb7e9184b931	b1fc8adc-355a-4c30-96f7-e8e34c40470b	ee629015-ca71-4837-8fef-c483f852dc81	Seed
ee6a503b-b496-42f8-8f7d-e397ec0f2171	b1fc8adc-355a-4c30-96f7-e8e34c40470b	025656d8-8a1b-44fb-8308-526eaa6c0a99	Series D
cf188255-2e13-497f-96c6-728ab3a14824	b1fc8adc-355a-4c30-96f7-e8e34c40470b	5454e6f5-2ec1-4542-ae4d-c8970996b738	Series B
16d9398b-81c3-4618-9716-c74b14df4f76	b1fc8adc-355a-4c30-96f7-e8e34c40470b	b7dbf436-3f88-42a8-81e4-fb650aaeb53b	Series A
3940d839-1158-4dc5-a455-7c163aa94583	b1fc8adc-355a-4c30-96f7-e8e34c40470b	b8f9a774-3004-4ae8-99ed-1352659307eb	Series A
20000b75-f188-4a44-876d-66e72caa015c	b1fc8adc-355a-4c30-96f7-e8e34c40470b	c1b9405b-2156-4b6e-9bd4-276aa8d49037	Seed
553d456e-7239-4f8c-beb2-52e228336c17	b1fc8adc-355a-4c30-96f7-e8e34c40470b	97111662-49c3-4980-b492-a2daf57760cb	Seed
cf945b2b-9ea5-491c-abbf-0124e6103ce1	b1fc8adc-355a-4c30-96f7-e8e34c40470b	5a8d7105-1c8e-4b5e-9674-45badc2d1417	Seed
100b971e-3806-42b4-b0f2-b38e37210fce	b1fc8adc-355a-4c30-96f7-e8e34c40470b	770aaac8-a125-4932-b194-b8b12d7877ea	Series C
434dcf73-6667-42c3-b96c-e6061def3873	b1fc8adc-355a-4c30-96f7-e8e34c40470b	73237cdb-24e4-4bc1-98c8-231d47b01e56	Series A
58127329-cd58-48f8-889e-83a62262a8d1	b1fc8adc-355a-4c30-96f7-e8e34c40470b	e6149988-c600-4e8d-8824-c25ccef5cd81	Series D
ea983f68-6131-48b7-9fcf-651bd55046bd	b1fc8adc-355a-4c30-96f7-e8e34c40470b	6a587305-e673-44b1-964f-3a23adcd7c8c	Series B
73df723d-f0a2-4e46-81d1-f52559f8b785	b1fc8adc-355a-4c30-96f7-e8e34c40470b	e6edb454-5eac-4418-b6a5-122ae83eb527	Series C
40122159-b12c-476e-aff0-79bd291ff870	b1fc8adc-355a-4c30-96f7-e8e34c40470b	0268b22c-612f-4f2e-9d9f-71ab1a3c175f	Series B
e81d1397-260f-4081-832e-f9105a87c939	b1fc8adc-355a-4c30-96f7-e8e34c40470b	af46f03a-43b4-4510-a929-37d2e577736b	Series A
dcbbbff4-038b-4dd1-8d5a-307db8d50eae	b1fc8adc-355a-4c30-96f7-e8e34c40470b	060ac9f3-7e19-406c-8cec-4c24e90445c2	Series A
aa663859-fb9c-4cce-87e6-a069de8dced5	b1fc8adc-355a-4c30-96f7-e8e34c40470b	a30f0b27-deeb-4860-a15e-93fce7efeb1f	Seed
99bce84b-bc28-469e-a83a-2e56161acb0e	b1fc8adc-355a-4c30-96f7-e8e34c40470b	83838f31-351e-44cb-8d62-8c41c47f2de6	Series B
dd903ec0-ca42-41d9-a00e-e337b0d26b44	b1fc8adc-355a-4c30-96f7-e8e34c40470b	1053bc5a-4805-4c31-b017-e8311ae36efc	Seed
2408401d-b2a0-4d89-8c3e-08aed49672d1	b1fc8adc-355a-4c30-96f7-e8e34c40470b	996a65e5-4253-4217-b3bb-ac1046ec5add	Series A
33e034d2-f9eb-4442-95f2-66a6b45ed6ea	b1fc8adc-355a-4c30-96f7-e8e34c40470b	2e5b1795-c288-4548-be57-c5c05b4b5dbe	Seed
cf08ef9f-0bcd-41a1-8ca0-8bd2845b3e1d	b1fc8adc-355a-4c30-96f7-e8e34c40470b	f26b39b5-bf4a-4ca8-a08b-2eea4ea8ca61	Series B
249ad7e6-50d1-4ef2-b432-a900eb40d776	b1fc8adc-355a-4c30-96f7-e8e34c40470b	9c215f93-55d3-484c-acff-2576d1b5c058	Series A
e33f5ff4-c80a-47a0-91a9-10dcd22b27bd	b1fc8adc-355a-4c30-96f7-e8e34c40470b	410311df-5e3f-4546-a6f3-c9a0d02e2ee7	Series A
33bf4f5a-798b-4733-bdee-bc1595b83711	b1fc8adc-355a-4c30-96f7-e8e34c40470b	3517c8a1-17de-4b5e-8537-19f13ebb4bd7	Seed
95d07b15-0b9a-411d-acc9-51b40a574fa9	b1fc8adc-355a-4c30-96f7-e8e34c40470b	fcb2f5f9-7707-4d4c-bf86-c83ee51880e2	Series A
b7b8af1c-e9f3-4099-9d2e-532f7e0d387a	b1fc8adc-355a-4c30-96f7-e8e34c40470b	523157f5-4b51-4d1b-a097-a1755eb5f167	Seed
679c28f8-a590-40d2-a59c-8702baa3e282	b1fc8adc-355a-4c30-96f7-e8e34c40470b	9faed36f-33fa-49c4-b32b-824868d07a07	Seed
317d2267-bb8b-4abf-89d7-b484611353eb	b1fc8adc-355a-4c30-96f7-e8e34c40470b	86c5619b-27d8-482c-bd57-422da2a72f96	Series A
b7722347-2a16-42d4-9a4a-9c67b4e7405b	b1fc8adc-355a-4c30-96f7-e8e34c40470b	f4e1e32f-dba8-45c0-aa8e-ec9bbe54d228	Series B
0828e30d-5c7c-41a8-9110-5086e71fea31	b1fc8adc-355a-4c30-96f7-e8e34c40470b	feb29bb7-e7d6-43f5-b4c1-299b00f7669f	Seed
2a0f06b8-6cda-4841-bc78-7eb10db7ca88	b1fc8adc-355a-4c30-96f7-e8e34c40470b	b942e2b4-1a17-4fec-a8ef-388ee3a02d5e	Series B
122c9a4d-e3f2-4547-9f0a-b79803da037b	b1fc8adc-355a-4c30-96f7-e8e34c40470b	67b4f98c-acd2-477b-80ed-254c461fbb99	Seed
e8c872ca-ba35-4dd9-bc26-efd6ed74c974	b1fc8adc-355a-4c30-96f7-e8e34c40470b	652610a7-100f-4491-9772-32c51d08534f	Series B
8df4984e-13e2-4b8d-b36a-f43e2964502f	b1fc8adc-355a-4c30-96f7-e8e34c40470b	f55da11a-d7c1-45c1-afce-b7e40f58c80c	Series C
6562848a-11bd-4a06-b3e9-b7ba29440d5b	b1fc8adc-355a-4c30-96f7-e8e34c40470b	65802d4c-7e94-48c9-9d78-5e6dca66855c	Series A
c741bc7a-6553-4b46-b9a8-990de102db2e	b1fc8adc-355a-4c30-96f7-e8e34c40470b	166d5ab3-5a7e-4669-8339-ca90185d168a	Seed
0599e9e0-763b-4be8-8e2d-7cfbb83dbfe4	b1fc8adc-355a-4c30-96f7-e8e34c40470b	dffd6829-fce3-494b-86eb-4c051efbf050	Series A
7729c680-3c54-4f0d-8f29-b7a21097ca37	b1fc8adc-355a-4c30-96f7-e8e34c40470b	bae1e8b5-98a6-4ec0-8585-03bdf0aba42d	Seed
5902662a-c2d2-493e-b78b-21bc8a0e9318	b1fc8adc-355a-4c30-96f7-e8e34c40470b	d1f58d13-f732-4509-98bb-e9b4bce979c0	Series B
4c878353-7503-4d3f-88b8-98a886fbb23f	b1fc8adc-355a-4c30-96f7-e8e34c40470b	c5a3e85f-772d-4c57-86d5-200287ffbc19	Seed
a9806521-5791-4160-b410-34eef6b07173	b1fc8adc-355a-4c30-96f7-e8e34c40470b	d3482119-1b21-4c9b-b932-bee08554e2bd	Seed
80b67625-f5f1-45a8-84ee-c0f8e15ba1fe	b1fc8adc-355a-4c30-96f7-e8e34c40470b	bd3a8cf5-dccf-480c-a45b-633974300085	Seed
006e5399-2038-42e6-a8de-872e1be7208b	b1fc8adc-355a-4c30-96f7-e8e34c40470b	66d11e12-dd53-4bf8-a695-f07d72c87f02	Series A
8010d1d6-8eef-4c9c-b46d-912ff56eb84d	b1fc8adc-355a-4c30-96f7-e8e34c40470b	ec2a479c-cf04-4ecc-a6b0-47534b6e093a	Seed
0e3ba03e-6c0f-4c87-afd7-7a12c1e28cf6	b1fc8adc-355a-4c30-96f7-e8e34c40470b	de0ded28-6b05-497b-abf7-356148fa38a1	Series A
a8863b5f-70c6-473f-a39f-b0b88b7a775a	b1fc8adc-355a-4c30-96f7-e8e34c40470b	bea5071d-50c3-48d8-a117-435da008bcb7	Series A
676c11db-2d2c-4220-98e5-89d1ee14114f	b1fc8adc-355a-4c30-96f7-e8e34c40470b	ddf3134d-6e88-482e-a8e3-4853e0ff05f0	Series A
4587acfa-d480-4eae-9a28-9c2b3bf18d0b	b1fc8adc-355a-4c30-96f7-e8e34c40470b	eb476fc1-66ce-4031-8319-a2a8bb4ee67e	Seed
51c4582e-5759-4307-94b3-6a36d491da91	b1fc8adc-355a-4c30-96f7-e8e34c40470b	f49d07a5-e7a2-45fe-beaf-0609d7a12532	Series A
2886c274-fece-48ee-a8cd-3be56198b491	b1fc8adc-355a-4c30-96f7-e8e34c40470b	58d0aa61-9d4d-41f1-8b3e-792207336c15	Series A
74082cb6-f39d-4aed-9a88-2f620532e434	b1fc8adc-355a-4c30-96f7-e8e34c40470b	e64d2f47-0818-4979-b7c9-d124bbe9f7f0	Seed
772bafc7-fcc6-4a49-aa32-b6783ac3268e	b1fc8adc-355a-4c30-96f7-e8e34c40470b	d95a4f4b-ae61-4788-afce-f097fbf7d8e6	Series B
b763aaba-f598-4f3b-9489-8436cfa7dd5e	b1fc8adc-355a-4c30-96f7-e8e34c40470b	58ae88a8-7e8c-424a-a050-dcbcd1da8590	Series A
511aa5d3-e393-4b63-8fe0-8580ea81b6b8	b1fc8adc-355a-4c30-96f7-e8e34c40470b	3c6326af-03a9-4678-8c6a-918e7be58b04	Seed
dbf8bbc8-6f4f-49c8-9880-845d33fcf3fe	b1fc8adc-355a-4c30-96f7-e8e34c40470b	bf572d60-98b1-48a0-ada8-421ff697cc7a	Series C
12f2e1b9-b2f7-4093-bc56-22c61dd96639	b1fc8adc-355a-4c30-96f7-e8e34c40470b	304faa34-9926-4622-a17d-2c90e765f2b0	Seed
ed495f0c-914b-43b1-95c9-54e13f305cd4	b1fc8adc-355a-4c30-96f7-e8e34c40470b	a4f50f4a-cf11-455a-bd00-e4ff551ff7bd	Seed
69bca0ff-9a4b-4200-a001-5f6451fbd299	b1fc8adc-355a-4c30-96f7-e8e34c40470b	ab09cae8-b19d-4a48-adb0-7ba24d8b41d1	Series A
fd686350-16b8-4c1c-a094-e99264fe8240	b1fc8adc-355a-4c30-96f7-e8e34c40470b	cf169017-7684-4523-9492-4875bbfdf946	Series A
3371d2ca-7041-4109-89e2-1c9436d2568d	b1fc8adc-355a-4c30-96f7-e8e34c40470b	ca74afb5-ded0-4ba0-9725-c568ddd962bc	Seed
58a61685-355b-4032-949a-677082637a1e	b1fc8adc-355a-4c30-96f7-e8e34c40470b	9fe2047c-e1a1-4e88-9085-102f52015563	Series A
ac37632c-e7ad-4826-a639-c3334e33ed94	b1fc8adc-355a-4c30-96f7-e8e34c40470b	e1a5d900-d2db-452c-bb44-5d35bd3e1942	Series B
d786096b-a8bb-4020-aa56-9667cedd9707	b1fc8adc-355a-4c30-96f7-e8e34c40470b	e49ff184-4f7f-452e-9aca-6e665ee83e81	Seed
3d19fb17-0f2a-4e78-a900-e58bd6c4fe2e	b1fc8adc-355a-4c30-96f7-e8e34c40470b	d54eb0a9-70fe-4c1c-a594-0ff793649149	Seed
bbc19c7e-1b87-43a7-a3b5-9d4e2ee32776	b1fc8adc-355a-4c30-96f7-e8e34c40470b	c863df8c-d38c-4fd3-82e3-e60b99bf6583	Series B+
c40347d5-52ca-4642-822a-33dec1bb3701	b1fc8adc-355a-4c30-96f7-e8e34c40470b	37719dca-68ef-4f32-a110-79d5dbe19d0a	Series A
82218e8d-c854-4fd0-b69f-ff22e246df48	b1fc8adc-355a-4c30-96f7-e8e34c40470b	459be105-8cc4-4544-adee-9b346ae1d897	Series A
e13ba723-7fbb-42e7-a8a5-79611d1d6fad	b1fc8adc-355a-4c30-96f7-e8e34c40470b	e504622c-89a2-4d9d-a0fe-13fb42e87016	Seed
e5fbf35d-84ee-4332-96b2-a5836bf46949	b1fc8adc-355a-4c30-96f7-e8e34c40470b	a94436ff-c313-4727-89da-2cf701b7af0a	Seed
c83d7f9b-cfef-42c1-863d-d4def020875b	b1fc8adc-355a-4c30-96f7-e8e34c40470b	6a3ed9ef-3005-4c83-951f-5c0f11478b3c	Seed
4b9b57a9-431b-4990-bd95-bb8ae691e976	b1fc8adc-355a-4c30-96f7-e8e34c40470b	c8f42c99-1bcb-42cf-bcc4-b15fef379cba	Series F
b63e9a3a-15f3-4d11-9724-9795b091e98c	b1fc8adc-355a-4c30-96f7-e8e34c40470b	70cee19a-cf2f-4d06-9208-a33c6833a62c	Seed
5da45e17-136d-41ad-a319-13dd0b3d5101	b1fc8adc-355a-4c30-96f7-e8e34c40470b	dd8f56e7-a0c5-41c8-8d74-19b06d6704cf	Series B
a342b3b3-c2a8-47b9-a245-3c3006b78767	b1fc8adc-355a-4c30-96f7-e8e34c40470b	48390061-bb7c-4bee-a65a-5901c619d78f	Seed
bb577783-fc26-44b0-b95d-67231824f8a8	b1fc8adc-355a-4c30-96f7-e8e34c40470b	32033c79-164b-4378-844d-361529bf7f43	Seed
f18120ba-5c88-4b46-96a0-ca24f069fca8	b1fc8adc-355a-4c30-96f7-e8e34c40470b	e83d809e-5b6f-43e9-8d39-b2a74273a7b7	Seed
880232b9-ac5e-43ec-9836-044ddadbad42	b1fc8adc-355a-4c30-96f7-e8e34c40470b	360f1e35-dadd-4715-9572-d68b2b745fc3	Seed
5cd0fb4c-13de-4956-92a4-6f4100ee1637	b1fc8adc-355a-4c30-96f7-e8e34c40470b	a30b52d5-d5cd-4076-afda-a8ad19d391eb	Series B
b814a8ad-c544-48ae-913c-c3ea16b5d7d0	b1fc8adc-355a-4c30-96f7-e8e34c40470b	3adc91aa-0226-44d8-8a8f-c8d7a1b5740b	Series A
9b738c9f-78d0-494c-9343-e8f908ae4183	b1fc8adc-355a-4c30-96f7-e8e34c40470b	bfe690f1-2da1-40d1-afc7-55b347f58ae7	Seed
0c008024-f087-4ac0-9b61-0243a7b43890	b1fc8adc-355a-4c30-96f7-e8e34c40470b	d3da6759-449a-4d9b-8c21-38f564e078e5	Series B
2796a1ec-6ae5-454f-afa8-19fa3559f950	b1fc8adc-355a-4c30-96f7-e8e34c40470b	cec971f0-2364-4d55-88cb-75b62ef6b7ac	Series A
62032b53-3548-430e-a5b8-468802d6e467	b1fc8adc-355a-4c30-96f7-e8e34c40470b	831332e7-942f-477a-afa2-2a1bd6261847	Series D
2acf33f2-1721-4f43-94cc-4187d14832dd	b1fc8adc-355a-4c30-96f7-e8e34c40470b	d9339692-3e93-4d0c-8af0-bc481f11cc15	Series A
a8c63d22-a899-47ff-a8c5-f3ce01b6189b	b1fc8adc-355a-4c30-96f7-e8e34c40470b	7e971505-8d9e-41c4-92b9-999239693cc1	Series D
77700edd-212a-4aba-b29b-736fc80504bd	b1fc8adc-355a-4c30-96f7-e8e34c40470b	b3c4f2c2-3457-4674-9749-69421e385c38	Seed
3ee0fdaf-b5ef-4599-b0d7-fbb59db30a7b	b1fc8adc-355a-4c30-96f7-e8e34c40470b	b5d8a805-c68c-432b-9298-135e197222ab	Seed
6e97f5e0-7315-43ab-9b0a-9709b2b56a77	b1fc8adc-355a-4c30-96f7-e8e34c40470b	62bab1bc-06e2-4c6b-9632-98bc3c133ee7	Pre-seed
f6c01f6a-1179-4d83-b92a-72f0ac1aeac1	b1fc8adc-355a-4c30-96f7-e8e34c40470b	cd2d474e-72c5-4a51-9d7b-95a4c0d4141d	Series A
5a07480c-dc3f-44b7-9407-edc934ee7eef	b1fc8adc-355a-4c30-96f7-e8e34c40470b	a5c7a498-70e4-49ca-84ce-3d2e85ee91cc	Series F
ba3a9efd-8c59-4d59-8ed4-cefc0e01fc5d	b1fc8adc-355a-4c30-96f7-e8e34c40470b	549bdc67-9e62-4a0f-a668-0c0e4d77649a	Seed
4373ea94-ea78-4843-97cb-35952360b833	b1fc8adc-355a-4c30-96f7-e8e34c40470b	72f1a0aa-b557-4f96-8be7-ffda7e0d97f1	Series B
335731d4-3a06-44c6-bc37-3991ae9e4e4f	b1fc8adc-355a-4c30-96f7-e8e34c40470b	4d546b6f-0ce1-49d3-a327-b4ce06529f24	Common Stock
ceaadac1-cdc5-419a-9599-7a171e3ae583	b1fc8adc-355a-4c30-96f7-e8e34c40470b	f036ae24-50b6-4b70-aa08-8be528938f89	Series B
d63dca71-4ee4-4e3a-910f-cdefeed1d96a	b1fc8adc-355a-4c30-96f7-e8e34c40470b	1a0b6a8c-aaec-4920-b222-8d687718dedc	Series A
2f97c797-62be-45eb-9997-cadc226f3588	b1fc8adc-355a-4c30-96f7-e8e34c40470b	09b8626e-b19b-4459-af2b-9972438cf58e	Seed
1a6cd5a2-f6ed-4c81-bf1c-4a334932887f	b1fc8adc-355a-4c30-96f7-e8e34c40470b	d8565df7-e2fc-4253-a1e5-1bd0a0dcb324	Series B
485cbe74-5a09-4f56-afbf-f0d5552741d7	b1fc8adc-355a-4c30-96f7-e8e34c40470b	9aed0db5-3982-4e24-ae90-7d542940dfa2	Series B
3dc91be3-854a-4444-ba83-4deabd5eb214	b1fc8adc-355a-4c30-96f7-e8e34c40470b	f9c5dd26-5184-465b-8436-5a733b3052ba	Series A
0d11f179-776c-45a8-ab2a-9ef206a55975	b1fc8adc-355a-4c30-96f7-e8e34c40470b	a4eb68c9-1b46-4704-a44f-df3dd76651e3	Seed
c015f6a5-1b45-47b8-b6f3-e8838c88940b	b1fc8adc-355a-4c30-96f7-e8e34c40470b	e3cb9ab4-7993-41a6-bcc0-dd5538275e44	Seed
5e4d4e65-97ba-4571-9b7d-f9a1315be805	b1fc8adc-355a-4c30-96f7-e8e34c40470b	d76b5464-8b23-41d5-aa06-48292db60024	Seed
f6fe3148-e25f-4eec-ac95-cba20e0a558a	b1fc8adc-355a-4c30-96f7-e8e34c40470b	790208a3-8a90-44fc-b8b9-8484fb5eaca0	Seed
cc62035e-5eb5-45b0-92ed-999129ba0282	b1fc8adc-355a-4c30-96f7-e8e34c40470b	c60650fa-c3d7-4b03-9612-b8c5f9ce1aa6	Seed
9b67366d-07a5-4838-8123-c7342c29cbe4	b1fc8adc-355a-4c30-96f7-e8e34c40470b	d5c28922-82c0-43b7-9e38-67deba996f32	Seed
d2ce908c-58ec-4d27-a3f0-a41bd9fe1db0	b1fc8adc-355a-4c30-96f7-e8e34c40470b	cd04d884-3b1e-4909-bebe-2dfca6abeb5e	Seed
c3fd8c7d-5eba-4ffc-96fb-a5a4253ebe81	b1fc8adc-355a-4c30-96f7-e8e34c40470b	3992b094-caf6-49dd-af2a-4664c0f44196	Seed
3dd56652-fe96-4c86-9544-dcc0de341c32	b1fc8adc-355a-4c30-96f7-e8e34c40470b	a0af367e-ad13-4e8d-bf9c-32c6e75bded2	Seed
973bfaec-fcb9-45c9-a3b7-dca4f38dd8a2	b1fc8adc-355a-4c30-96f7-e8e34c40470b	4e8ba09c-4df6-43b6-ad04-5ffdab3190e1	Seed
82fb2a5a-4f30-4414-99b5-849dc4884216	b1fc8adc-355a-4c30-96f7-e8e34c40470b	94806c6c-2f31-4045-a1d2-81f7ada9ab4e	Series A
bb9a6313-2223-455e-9d30-a041518b31f4	b1fc8adc-355a-4c30-96f7-e8e34c40470b	989e9e98-f4ed-4c1c-be42-eec6c9433294	Seed
48ff5f62-3a43-4748-b96a-ba408a9366d5	b1fc8adc-355a-4c30-96f7-e8e34c40470b	bba901ce-3969-463f-b730-df718a9b1044	Series A
b4809182-eeac-445b-82f1-7855a4aa2b2b	b1fc8adc-355a-4c30-96f7-e8e34c40470b	f348e8b7-b9bf-4bc0-93f5-9d62b139c61b	Series E
b675c045-17d6-43e1-8671-252e45e3468a	b1fc8adc-355a-4c30-96f7-e8e34c40470b	24b8298a-c57e-4d73-91e7-7eb3e92f988d	Seed
e22e687f-5e7c-4284-b38b-10b177632b81	b1fc8adc-355a-4c30-96f7-e8e34c40470b	562b2b1f-2028-4a0c-846c-2532ab95a6f7	Series F
02e5d49b-bf2d-414b-a447-535944bc2124	b1fc8adc-355a-4c30-96f7-e8e34c40470b	3a8e244d-d549-456b-bf02-a98745991e99	Seed
6c390ee3-452b-4dd0-93ac-c4d8bc6d5257	b1fc8adc-355a-4c30-96f7-e8e34c40470b	3c7eb52c-c17a-41fb-980f-408b7a2f4d17	Series A
7cbfca18-1910-4884-8b89-e8aba7140ab6	b1fc8adc-355a-4c30-96f7-e8e34c40470b	5b37cf16-275a-4390-9eb0-9980cb5f0bed	Series D
\.


--
-- Data for Name: vertical_focus; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vertical_focus (id, org_id, vertical_id, preferred_stage, typical_check_size) FROM stdin;
147dc79d-0145-4257-ba07-20921b643a0e	b1fc8adc-355a-4c30-96f7-e8e34c40470b	db418a6b-18a0-4f80-9183-81d8f40be974	\N	\N
0d1e9c46-aa2f-44b5-b25c-aa47e7fc24da	b1fc8adc-355a-4c30-96f7-e8e34c40470b	531d29ca-fbb6-4090-93ca-27989844cc46	\N	\N
3ed11ce1-b7c5-4817-a609-6e9b0177de81	b1fc8adc-355a-4c30-96f7-e8e34c40470b	a8009b90-5fa9-428c-b5ce-69505246f955	\N	\N
97332d9d-b8b5-4500-b643-423174e0b9e7	b1fc8adc-355a-4c30-96f7-e8e34c40470b	bb66aaa2-76a9-4a32-8eb3-7273594ed1ab	\N	\N
74bdece4-4329-4650-8269-0ecfe903b563	b1fc8adc-355a-4c30-96f7-e8e34c40470b	8a4f618c-db0a-4685-8a56-31893dad5eca	\N	\N
2e0157ca-600a-4535-a1b7-acfb09ea44b8	b1fc8adc-355a-4c30-96f7-e8e34c40470b	bf1764a7-7f1c-48ca-819d-b922db907c09	\N	\N
57f6b79e-e9d9-406c-8ac4-8ef7994494d8	b1fc8adc-355a-4c30-96f7-e8e34c40470b	92a5b95a-b64f-445e-87ad-04bf2620f4cd	\N	\N
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: realtime; Owner: supabase_admin
--

COPY realtime.schema_migrations (version, inserted_at) FROM stdin;
20211116024918	2026-07-09 05:51:18
20211116045059	2026-07-09 05:51:18
20211116050929	2026-07-09 05:51:19
20211116051442	2026-07-09 05:51:19
20211116212300	2026-07-09 05:51:19
20211116213355	2026-07-09 05:51:19
20211116213934	2026-07-09 05:51:19
20211116214523	2026-07-09 05:51:19
20211122062447	2026-07-09 05:51:19
20211124070109	2026-07-09 05:51:19
20211202204204	2026-07-09 05:51:20
20211202204605	2026-07-09 05:51:20
20211210212804	2026-07-09 05:51:20
20211228014915	2026-07-09 05:51:20
20220107221237	2026-07-09 05:51:21
20220228202821	2026-07-09 05:51:21
20220312004840	2026-07-09 05:51:21
20220603231003	2026-07-09 05:51:21
20220603232444	2026-07-09 05:51:21
20220615214548	2026-07-09 05:51:21
20220712093339	2026-07-09 05:51:21
20220908172859	2026-07-09 05:51:21
20220916233421	2026-07-09 05:51:22
20230119133233	2026-07-09 05:51:22
20230128025114	2026-07-09 05:51:22
20230128025212	2026-07-09 05:51:22
20230227211149	2026-07-09 05:51:22
20230228184745	2026-07-09 05:51:22
20230308225145	2026-07-09 05:51:22
20230328144023	2026-07-09 05:51:22
20231018144023	2026-07-09 05:51:23
20231204144023	2026-07-09 05:51:23
20231204144024	2026-07-09 05:51:23
20231204144025	2026-07-09 05:51:23
20240108234812	2026-07-09 05:51:23
20240109165339	2026-07-09 05:51:23
20240227174441	2026-07-09 05:51:24
20240311171622	2026-07-09 05:51:24
20240321100241	2026-07-09 05:51:24
20240401105812	2026-07-09 05:51:24
20240418121054	2026-07-09 05:51:24
20240523004032	2026-07-09 05:51:25
20240618124746	2026-07-09 05:51:25
20240801235015	2026-07-09 05:51:25
20240805133720	2026-07-09 05:51:25
20240827160934	2026-07-09 05:51:25
20240919163303	2026-07-09 05:51:26
20240919163305	2026-07-09 05:51:26
20241019105805	2026-07-09 05:51:26
20241030150047	2026-07-09 05:51:26
20241108114728	2026-07-09 05:51:26
20241121104152	2026-07-09 05:51:27
20241130184212	2026-07-09 05:51:27
20241220035512	2026-07-09 05:51:27
20241220123912	2026-07-09 05:51:27
20241224161212	2026-07-09 05:51:27
20250107150512	2026-07-09 05:51:27
20250110162412	2026-07-09 05:51:27
20250123174212	2026-07-09 05:51:27
20250128220012	2026-07-09 05:51:28
20250506224012	2026-07-09 05:51:28
20250523164012	2026-07-09 05:51:28
20250714121412	2026-07-09 05:51:28
20250905041441	2026-07-09 05:51:28
20251103001201	2026-07-09 05:51:28
20251120212548	2026-07-09 05:51:28
20251120215549	2026-07-09 05:51:28
20260218120000	2026-07-09 05:51:28
20260326120000	2026-07-09 05:51:29
20260514120000	2026-07-09 05:51:29
20260527120000	2026-07-09 05:51:29
20260528120000	2026-07-09 05:51:29
20260603120000	2026-07-09 05:51:29
20260605120000	2026-07-09 05:51:30
20260606110000	2026-07-09 05:51:30
20260616120000	2026-07-09 05:51:30
20260624120000	2026-07-09 05:51:30
20260626120000	2026-07-09 05:51:31
20260706120000	2026-07-09 05:51:31
\.


--
-- Data for Name: subscription; Type: TABLE DATA; Schema: realtime; Owner: supabase_admin
--

COPY realtime.subscription (id, subscription_id, entity, filters, claims, created_at, action_filter, selected_columns) FROM stdin;
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.buckets (id, name, owner, created_at, updated_at, public, avif_autodetection, file_size_limit, allowed_mime_types, owner_id, type) FROM stdin;
\.


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.buckets_analytics (name, type, format, created_at, updated_at, id, deleted_at) FROM stdin;
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.migrations (id, name, hash, executed_at) FROM stdin;
0	create-migrations-table	e18db593bcde2aca2a408c4d1100f6abba2195df	2026-07-09 02:34:54.628785
1	initialmigration	6ab16121fbaa08bbd11b712d05f358f9b555d777	2026-07-09 02:34:54.667143
2	storage-schema	f6a1fa2c93cbcd16d4e487b362e45fca157a8dbd	2026-07-09 02:34:54.672951
3	pathtoken-column	2cb1b0004b817b29d5b0a971af16bafeede4b70d	2026-07-09 02:34:54.698349
4	add-migrations-rls	427c5b63fe1c5937495d9c635c263ee7a5905058	2026-07-09 02:34:54.715444
5	add-size-functions	79e081a1455b63666c1294a440f8ad4b1e6a7f84	2026-07-09 02:34:54.723543
6	change-column-name-in-get-size	ded78e2f1b5d7e616117897e6443a925965b30d2	2026-07-09 02:34:54.729667
7	add-rls-to-buckets	e7e7f86adbc51049f341dfe8d30256c1abca17aa	2026-07-09 02:34:54.735931
8	add-public-to-buckets	fd670db39ed65f9d08b01db09d6202503ca2bab3	2026-07-09 02:34:54.741846
9	fix-search-function	af597a1b590c70519b464a4ab3be54490712796b	2026-07-09 02:34:54.747746
10	search-files-search-function	b595f05e92f7e91211af1bbfe9c6a13bb3391e16	2026-07-09 02:34:54.75447
11	add-trigger-to-auto-update-updated_at-column	7425bdb14366d1739fa8a18c83100636d74dcaa2	2026-07-09 02:34:54.760903
12	add-automatic-avif-detection-flag	8e92e1266eb29518b6a4c5313ab8f29dd0d08df9	2026-07-09 02:34:54.767084
13	add-bucket-custom-limits	cce962054138135cd9a8c4bcd531598684b25e7d	2026-07-09 02:34:54.773237
14	use-bytes-for-max-size	941c41b346f9802b411f06f30e972ad4744dad27	2026-07-09 02:34:54.779484
15	add-can-insert-object-function	934146bc38ead475f4ef4b555c524ee5d66799e5	2026-07-09 02:34:54.808016
16	add-version	76debf38d3fd07dcfc747ca49096457d95b1221b	2026-07-09 02:34:54.814136
17	drop-owner-foreign-key	f1cbb288f1b7a4c1eb8c38504b80ae2a0153d101	2026-07-09 02:34:54.820352
18	add_owner_id_column_deprecate_owner	e7a511b379110b08e2f214be852c35414749fe66	2026-07-09 02:34:54.826701
19	alter-default-value-objects-id	02e5e22a78626187e00d173dc45f58fa66a4f043	2026-07-09 02:34:54.834821
20	list-objects-with-delimiter	cd694ae708e51ba82bf012bba00caf4f3b6393b7	2026-07-09 02:34:54.841785
21	s3-multipart-uploads	8c804d4a566c40cd1e4cc5b3725a664a9303657f	2026-07-09 02:34:54.849808
22	s3-multipart-uploads-big-ints	9737dc258d2397953c9953d9b86920b8be0cdb73	2026-07-09 02:34:54.865347
23	optimize-search-function	9d7e604cddc4b56a5422dc68c9313f4a1b6f132c	2026-07-09 02:34:54.876458
24	operation-function	8312e37c2bf9e76bbe841aa5fda889206d2bf8aa	2026-07-09 02:34:54.882686
25	custom-metadata	d974c6057c3db1c1f847afa0e291e6165693b990	2026-07-09 02:34:54.889492
26	objects-prefixes	215cabcb7f78121892a5a2037a09fedf9a1ae322	2026-07-09 02:34:54.895709
27	search-v2	859ba38092ac96eb3964d83bf53ccc0b141663a6	2026-07-09 02:34:54.901128
28	object-bucket-name-sorting	c73a2b5b5d4041e39705814fd3a1b95502d38ce4	2026-07-09 02:34:54.906565
29	create-prefixes	ad2c1207f76703d11a9f9007f821620017a66c21	2026-07-09 02:34:54.911914
30	update-object-levels	2be814ff05c8252fdfdc7cfb4b7f5c7e17f0bed6	2026-07-09 02:34:54.917321
31	objects-level-index	b40367c14c3440ec75f19bbce2d71e914ddd3da0	2026-07-09 02:34:54.922915
32	backward-compatible-index-on-objects	e0c37182b0f7aee3efd823298fb3c76f1042c0f7	2026-07-09 02:34:54.928337
33	backward-compatible-index-on-prefixes	b480e99ed951e0900f033ec4eb34b5bdcb4e3d49	2026-07-09 02:34:54.933686
34	optimize-search-function-v1	ca80a3dc7bfef894df17108785ce29a7fc8ee456	2026-07-09 02:34:54.939085
35	add-insert-trigger-prefixes	458fe0ffd07ec53f5e3ce9df51bfdf4861929ccc	2026-07-09 02:34:54.944515
36	optimise-existing-functions	6ae5fca6af5c55abe95369cd4f93985d1814ca8f	2026-07-09 02:34:54.950551
37	add-bucket-name-length-trigger	3944135b4e3e8b22d6d4cbb568fe3b0b51df15c1	2026-07-09 02:34:54.95578
38	iceberg-catalog-flag-on-buckets	02716b81ceec9705aed84aa1501657095b32e5c5	2026-07-09 02:34:54.96204
39	add-search-v2-sort-support	6706c5f2928846abee18461279799ad12b279b78	2026-07-09 02:34:54.97482
40	fix-prefix-race-conditions-optimized	7ad69982ae2d372b21f48fc4829ae9752c518f6b	2026-07-09 02:34:54.980202
41	add-object-level-update-trigger	07fcf1a22165849b7a029deed059ffcde08d1ae0	2026-07-09 02:34:54.985529
42	rollback-prefix-triggers	771479077764adc09e2ea2043eb627503c034cd4	2026-07-09 02:34:54.990856
43	fix-object-level	84b35d6caca9d937478ad8a797491f38b8c2979f	2026-07-09 02:34:54.996116
44	vector-bucket-type	99c20c0ffd52bb1ff1f32fb992f3b351e3ef8fb3	2026-07-09 02:34:55.001494
45	vector-buckets	049e27196d77a7cb76497a85afae669d8b230953	2026-07-09 02:34:55.007521
46	buckets-objects-grants	fedeb96d60fefd8e02ab3ded9fbde05632f84aed	2026-07-09 02:34:55.018458
47	iceberg-table-metadata	649df56855c24d8b36dd4cc1aeb8251aa9ad42c2	2026-07-09 02:34:55.024505
48	iceberg-catalog-ids	e0e8b460c609b9999ccd0df9ad14294613eed939	2026-07-09 02:34:55.030183
49	buckets-objects-grants-postgres	072b1195d0d5a2f888af6b2302a1938dd94b8b3d	2026-07-09 02:34:55.046442
50	search-v2-optimised	6323ac4f850aa14e7387eb32102869578b5bd478	2026-07-09 02:34:55.052718
51	index-backward-compatible-search	2ee395d433f76e38bcd3856debaf6e0e5b674011	2026-07-09 02:34:55.693254
52	drop-not-used-indexes-and-functions	5cc44c8696749ac11dd0dc37f2a3802075f3a171	2026-07-09 02:34:55.696272
53	drop-index-lower-name	d0cb18777d9e2a98ebe0bc5cc7a42e57ebe41854	2026-07-09 02:34:55.707807
54	drop-index-object-level	6289e048b1472da17c31a7eba1ded625a6457e67	2026-07-09 02:34:55.711834
55	prevent-direct-deletes	262a4798d5e0f2e7c8970232e03ce8be695d5819	2026-07-09 02:34:55.714668
56	fix-optimized-search-function	b823ed1e418101032fa01374edc9a436e54e3ed4	2026-07-09 02:34:55.721398
57	s3-multipart-uploads-metadata	f127886e00d1b374fadbc7c6b31e09336aad5287	2026-07-09 02:34:55.729754
58	operation-ergonomics	00ca5d483b3fe0d522133d9002ccc5df98365120	2026-07-09 02:34:55.735631
59	drop-unused-functions	38456f13e39691c2bbb4b5151d0d1cdbabd4a8c4	2026-07-09 02:34:55.742144
60	optimize-existing-functions-again	db35e1c91a9201e59f4fef8d972c2f277d68b157	2026-07-09 02:34:55.749229
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata, version, owner_id, user_metadata) FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.s3_multipart_uploads (id, in_progress_size, upload_signature, bucket_id, key, version, owner_id, created_at, user_metadata, metadata) FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.s3_multipart_uploads_parts (id, upload_id, size, part_number, bucket_id, key, etag, owner_id, version, created_at) FROM stdin;
\.


--
-- Data for Name: secrets; Type: TABLE DATA; Schema: vault; Owner: supabase_admin
--

COPY vault.secrets (id, name, description, secret, key_id, nonce, created_at, updated_at) FROM stdin;
\.


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('auth.refresh_tokens_id_seq', 1, false);


--
-- Name: subscription_id_seq; Type: SEQUENCE SET; Schema: realtime; Owner: supabase_admin
--

SELECT pg_catalog.setval('realtime.subscription_id_seq', 1, false);


--
-- PostgreSQL database dump complete
--

\unrestrict W1fnMaqW12R94zaR0jpfWorSBDpzlOf6v4c03BhKhswy1rjsp1xDNAaIJ9DtzdZ

